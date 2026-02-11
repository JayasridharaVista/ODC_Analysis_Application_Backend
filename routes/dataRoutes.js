const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const pool = require("../db");
const upload = multer({ dest: "uploads/" });



// 2. Fetch Data for the React Dashboard

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    console.log("All Sheets:", workbook.SheetNames);
    // ✅ Pick correct sheet
  const sheetName =req.body.sheetName || "Input daily data";
  console.log("Selected Sheet:", sheetName);
    const sheet = workbook.Sheets[sheetName];

    // ✅ Convert Excel to JSON
    const rawData = xlsx.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false
    });

    // 🔍 Debug once (optional)
    console.log("Excel Headers:", Object.keys(rawData[0]));

    // ✅ 👉 UPDATE THIS PART (NORMALIZATION)
   // ✅ Normalization helpers (paste here)
    const normalize = (s) =>
      (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

    const normalizeEmployeeName = (name) => {
      if (!name) return null;

      return name
        .toString()
        .toLowerCase()
        .replace(/\./g, " ")      // remove dots
        .replace(/\s+/g, " ")     // remove extra spaces
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase()); // capitalize
    };

    const findVal = (row, name) => {
      const keys = Object.keys(row);
      const match = keys.find(
        k => normalize(k) === normalize(name)
      );
      return match ? row[match] : null;
    };
    const parseNumber = (val) => {
      if (!val) return null;

      const cleaned = val
        .toString()
        .replace("%", "")
        .trim();

      if (cleaned === "") return null;

      const num = parseFloat(cleaned);

      return isNaN(num) ? null : num;
    };
    // ✅ Flexible column mapping
    const data = rawData.map(row => ({
      cw: findVal(row, "cw"),
      work_date: findVal(row, "date")
        ? new Date(findVal(row, "date"))
        : null,
      quarter: findVal(row, "quarter"),
      month: findVal(row, "month"),
      year: findVal(row, "year"),
      employee_number:findVal(row, "vista empolyee number") ||findVal(row, "vista employee number"),
      employee_name: normalizeEmployeeName(findVal(row, "employee name")),
      attendance: findVal(row, "attendance"),
      function_name: findVal(row, "function"),
      task: findVal(row, "task"),
      achieved_frames:parseNumber(
        findVal(row, "acheived frames/images") ||
        findVal(row, "achieved frames/images")
      ),
      effort: parseNumber(findVal(row, "effort")),
      efficiency: parseNumber(findVal(row, "efficiency"))
    }));
    console.log("First mapped row:", data[0]);
    // If caller asked for a preview or values extraction, return parsed results without inserting
    const mode = req.body && req.body.mode ? req.body.mode.toString().toLowerCase() : null;
    if (mode === 'preview') {
      const sampleHeaders = rawData && rawData.length ? Object.keys(rawData[0]) : [];
      return res.json({ sampleHeaders, preview: data.slice(0, 10) });
    }
    if (mode === 'values') {
      // derive distinct values from the uploaded file (parsed rows)
      const dates = Array.from(new Set(data.map(d => d.work_date ? (d.work_date instanceof Date ? d.work_date.toISOString() : new Date(d.work_date).toISOString()) : null).filter(Boolean))).sort();
      const employees = Array.from(new Set(data.map(d => d.employee_name).filter(Boolean))).sort();
      const functions = Array.from(new Set(data.map(d => d.function_name).filter(Boolean))).sort();
      const cws = Array.from(new Set(data.map(d => d.cw).filter(Boolean))).sort((a,b) => (Number(a)||0)-(Number(b)||0));
      const months = Array.from(new Set(data.map(d => d.month).filter(Boolean))).sort();
      const quarters = Array.from(new Set(data.map(d => d.quarter).filter(Boolean))).sort((a,b) => (Number(a)||0)-(Number(b)||0));
      const years = Array.from(new Set(data.map(d => d.year).filter(Boolean))).sort((a,b) => (Number(a)||0)-(Number(b)||0));
      return res.json({ dates, employees, functions, cws, months, quarters, years });
    }
    // ✅ SQL INSERT
    const query = `
      INSERT INTO daily_data (
        cw,
        work_date,
        quarter,
        month,
        year,
        employee_number,
        employee_name,
        attendance,
        function_name,
        task,
        achieved_frames,
        effort,
        efficiency
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `;

    // ✅ Insert rows
    for (const row of data) {
      await pool.query(query, [
        row.cw,
        row.work_date,
        row.quarter,
        row.month,
        row.year,
        row.employee_number,
        row.employee_name,
        row.attendance,
        row.function_name,
        row.task,
        row.achieved_frames,
        row.effort,
        row.efficiency
      ]);
    }

    res.json({ message: "Data imported successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});


router.get("/stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT work_date, AVG(efficiency) as avg_efficiency 
      FROM daily_data 
      GROUP BY work_date 
      ORDER BY work_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Return distinct values for UI selectors (dates, employees, functions, cw, month, quarter, year)
router.get('/values', async (req, res) => {
  try {
    const qDates = pool.query("SELECT DISTINCT work_date FROM daily_data WHERE work_date IS NOT NULL ORDER BY work_date ASC");
    const qEmployees = pool.query(`
      SELECT DISTINCT 
      INITCAP(TRIM(REPLACE(employee_name,'.',' '))) AS employee_name
      FROM daily_data
      WHERE employee_name IS NOT NULL
      ORDER BY employee_name ASC
    `);
    const qFunctions = pool.query("SELECT DISTINCT function_name FROM daily_data WHERE function_name IS NOT NULL ORDER BY function_name ASC");
    const qCw = pool.query("SELECT DISTINCT cw FROM daily_data WHERE cw IS NOT NULL ORDER BY cw::int ASC");
    const qMonth = pool.query(`
      SELECT month FROM (
        SELECT DISTINCT month,
        CASE month
          WHEN 'Jan' THEN 1
          WHEN 'Feb' THEN 2
          WHEN 'Mar' THEN 3
          WHEN 'Apr' THEN 4
          WHEN 'May' THEN 5
          WHEN 'Jun' THEN 6
          WHEN 'Jul' THEN 7
          WHEN 'Aug' THEN 8
          WHEN 'Sep' THEN 9
          WHEN 'Oct' THEN 10
          WHEN 'Nov' THEN 11
          WHEN 'Dec' THEN 12
        END AS month_order
        FROM daily_data
        WHERE month IS NOT NULL
      ) t
      ORDER BY month_order
    `);
    const qQuarter = pool.query("SELECT DISTINCT quarter FROM daily_data WHERE quarter IS NOT NULL ORDER BY quarter::int ASC");
    const qYear = pool.query("SELECT DISTINCT year FROM daily_data WHERE year IS NOT NULL ORDER BY year::int ASC");

    const [datesR, empR, fnR, cwR, monthR, qR, yR] = await Promise.all([qDates, qEmployees, qFunctions, qCw, qMonth, qQuarter, qYear]);

    const dates = datesR.rows.map(r => (r.work_date ? r.work_date.toISOString() : null)).filter(Boolean);
    const employees = empR.rows.map(r => r.employee_name);
    const functions = fnR.rows.map(r => r.function_name);
    const cws = cwR.rows.map(r => r.cw);
    const months = monthR.rows.map(r => r.month);
    const quarters = qR.rows.map(r => r.quarter);
    const years = yR.rows.map(r => r.year);

    res.json({ dates, employees, functions, cws, months, quarters, years });
  } catch (err) {
    console.error('Failed to fetch values', err);
    res.status(500).json({ error: 'Failed to fetch values' });
  }
});


router.get("/analytics", async (req, res) => {
  try {
    const {
      dates,
      months,
      employeenames,
      functions,
      cws,
      quarters,
      years
    } = req.query;

    let conditions = [];
    let values = [];
    let index = 1;

    const addArrayFilter = (field, data) => {
      if (!data) return;
      const arr = data.split(",");
      conditions.push(`${field} = ANY($${index++})`);
      values.push(arr);
    };

    addArrayFilter("work_date", dates);
    addArrayFilter("month", months);
    addArrayFilter("employee_name", employeenames);
    addArrayFilter("function_name", functions);
    addArrayFilter("cw", cws);
    addArrayFilter("quarter", quarters);
    addArrayFilter("year", years);

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // ===== 1. SUM EFFICIENCY BY DATE =====
    const dateQuery = `
      SELECT
        work_date,
        SUM(efficiency) AS sum_efficiency
      FROM daily_data
      ${where}
      GROUP BY work_date
      ORDER BY work_date
    `;

    // ===== 2. AVG EFFICIENCY BY MONTH =====
    const monthQuery = `
      SELECT
        month,
        AVG(efficiency) AS avg_efficiency
      FROM daily_data
      ${where}
      GROUP BY month
      ORDER BY month
    `;

    // ===== 3. AVG EFFICIENCY BY CW =====
    const cwQuery = `
      SELECT
        cw,
        AVG(efficiency) AS avg_efficiency
      FROM daily_data
      ${where}
      GROUP BY cw
      ORDER BY cw
    `;

    // ===== 4. ATTENDANCE COUNT BY EMPLOYEE =====
    const employeeQuery = `
      SELECT
        employee_name,
        COUNT(attendance) AS attendance_count
      FROM daily_data
      ${where}
      GROUP BY employee_name
      ORDER BY employee_name
    `;

    const [dateData, monthData, cwData, employeeData] =
      await Promise.all([
        pool.query(dateQuery, values),
        pool.query(monthQuery, values),
        pool.query(cwQuery, values),
        pool.query(employeeQuery, values)
      ]);

    res.json({
      dateData: dateData.rows,
      monthData: monthData.rows,
      cwData: cwData.rows,
      employeeData: employeeData.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analytics fetch failed" });
  }
});




module.exports = router;