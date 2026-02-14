const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const pool = require("../db");
const upload = multer({ dest: "uploads/" });
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
  router.get("/download-pdf", async (req, res) => {
  try {

    const {
      fromDate,
      toDate,
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

      let arr = data.split(",").filter(v => v !== "");

      if (arr.length === 0) return;

      if (field === "work_date") {
        conditions.push(`${field}::date = ANY($${index++}::date[])`);
        values.push(arr);
        return;
      }

      if (["cw","quarter","year"].includes(field)) {
        conditions.push(`${field} = ANY($${index++}::int[])`);
        values.push(arr.map(Number));
        return;
      }

      conditions.push(`${field} = ANY($${index++}::text[])`);
      values.push(arr);
    };

    addArrayFilter("work_date", dates);
    addArrayFilter("month", months);
    addArrayFilter("employee_name", employeenames);
    addArrayFilter("function_name", functions);
    addArrayFilter("cw", cws);
    addArrayFilter("quarter", quarters);
    addArrayFilter("year", years);

    if (fromDate && toDate) {
      conditions.push(`work_date BETWEEN $${index++} AND $${index++}`);
      values.push(fromDate, toDate);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT *
       FROM daily_data
       ${where}
       ORDER BY work_date`,
      values
    );

    // ===== CREATE PDF =====
    const doc = new PDFDocument({ margin: 30, size:"A4" });

    res.setHeader("Content-Type","application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Dashboard.pdf"
    );

    doc.pipe(res);

    doc.fontSize(18).text("ODC Performance Dashboard Report");
    doc.moveDown();

    result.rows.forEach(r => {
      doc.fontSize(10).text(
        `${r.work_date} | ${r.employee_name} | ${r.function_name} | CW:${r.cw} | Eff:${r.efficiency}`
      );
    });

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"PDF Download Failed" });
  }
});
  router.get("/download-excel", async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM daily_data`);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Data");

      // ===== ADD HEADERS =====
      sheet.columns = [
        { header: "CW", key: "cw" },
        { header: "Work Date", key: "work_date" },
        { header: "Quarter", key: "quarter" },
        { header: "Month", key: "month" },
        { header: "Year", key: "year" },
        { header: "Employee Name", key: "employee_name" },
        { header: "Function", key: "function_name" },
        { header: "Attendance", key: "attendance" },
        { header: "Efficiency", key: "efficiency" }
      ];

      result.rows.forEach(row => {
        sheet.addRow(row);
      });

      // Convert to Table
      sheet.addTable({
        name: "DailyData",
        ref: "A1",
        headerRow: true,
        columns: sheet.columns.map(col => ({ name: col.header })),
        rows: result.rows.map(r => [
          r.cw,
          r.work_date,
          r.quarter,
          r.month,
          r.year,
          r.employee_name,
          r.function_name,
          r.attendance,
          r.efficiency
        ])
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Dashboard.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Excel download failed" });
    }
  });


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
      ? new Date(findVal(row, "date")).toISOString().split("T")[0]
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



// router.get("/values", async (req, res) => {
//   try {
//     const {
//       fromDate,
//       toDate,
//       dates,
//       months,
//       employeenames,
//       functions,
//       cws,
//       quarters,
//       years,
//     } = req.query;

//     let conditions = [];
//     let values = [];
//     let index = 1;

//     const addArrayFilter = (field, data) => {
//       if (!data) return;

//       // remove empty values
//       let arr = data
//         .split(",")
//         .map(v => v.trim())
//         .filter(v => v !== "");

//       if (arr.length === 0) return;   // 🚀 important

//       if (field === "work_date") {
//         conditions.push(`${field} = ANY($${index++}::date[])`);
//         values.push(arr);
//         return;
//       }

//       if (["cw", "quarter", "year"].includes(field)) {
//         arr = arr.map(v => Number(v));
//         conditions.push(`${field} = ANY($${index++}::int[])`);
//         values.push(arr);
//         return;
//       }

//       conditions.push(`${field} = ANY($${index++}::text[])`);
//       values.push(arr);
//     };

    

//     // Apply filters
//     addArrayFilter("work_date", dates);
//     addArrayFilter("month", months);
//     addArrayFilter("employee_name", employeenames);
//     addArrayFilter("function_name", functions);
//     addArrayFilter("cw", cws);
//     addArrayFilter("quarter", quarters);
//     addArrayFilter("year", years);

//     // Date range filter
//     if (!dates && fromDate && toDate) {
//       conditions.push(
//         `work_date BETWEEN $${index++} AND $${index++}`
//       );
//       values.push(fromDate, toDate);
//     }

//     const where = conditions.length
//       ? `WHERE ${conditions.join(" AND ")}`
//       : "";

//     const query = `
//       SELECT
//        ARRAY_AGG(
//         DISTINCT TO_CHAR(work_date,'YYYY-MM-DD')
//         ORDER BY TO_CHAR(work_date,'YYYY-MM-DD')
//       ) AS dates,
//         ARRAY_AGG(DISTINCT employee_name ORDER BY employee_name) AS employees,
//         ARRAY_AGG(DISTINCT function_name ORDER BY function_name) AS functions,
//         ARRAY_AGG(DISTINCT cw ORDER BY cw) AS cws,
//         ARRAY_AGG(DISTINCT month ORDER BY month) AS months,
//         ARRAY_AGG(DISTINCT quarter ORDER BY quarter) AS quarters,
//         ARRAY_AGG(DISTINCT year ORDER BY year) AS years
//       FROM daily_data
//       ${where}
//     `;

//     const result = await pool.query(query, values);

//     res.json(result.rows[0] || {});

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Dynamic values fetch failed" });
//   }
// });


router.get("/values", async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      dates,
      months,
      employeenames,
      functions,
      cws,
      quarters,
      years,
    } = req.query;

    // ===== BUILD WHERE FUNCTION =====
    const buildWhere = (excludeField = null) => {
      let conditions = [];
      let values = [];
      let index = 1;

      const addArrayFilter = (field, data) => {
        if (excludeField === field) return;
        if (!data) return;

        let arr = data
          .split(",")
          .map(v => v.trim())
          .filter(v => v !== "");

        if (arr.length === 0) return;

        if (field === "work_date") {
          conditions.push(`${field} = ANY($${index++}::date[])`);
          values.push(arr);
          return;
        }

        if (["cw", "quarter", "year"].includes(field)) {
          conditions.push(`${field} = ANY($${index++}::int[])`);
          values.push(arr.map(Number));
          return;
        }

        conditions.push(`${field} = ANY($${index++}::text[])`);
        values.push(arr);
      };

      addArrayFilter("work_date", dates);
      addArrayFilter("month", months);
      addArrayFilter("employee_name", employeenames);
      addArrayFilter("function_name", functions);
      addArrayFilter("cw", cws);
      addArrayFilter("quarter", quarters);
      addArrayFilter("year", years);

      if (!dates && fromDate && toDate && excludeField !== "work_date") {
        conditions.push(`work_date BETWEEN $${index++} AND $${index++}`);
        values.push(fromDate, toDate);
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      return { where, values };
    };

    // ===== CREATE FILTERS =====
    const dateFilter = buildWhere("work_date");
    const employeeFilter = buildWhere("employee_name");
    const functionFilter = buildWhere("function_name");
    const cwFilter = buildWhere("cw");
    const monthFilter = buildWhere("month");
    const quarterFilter = buildWhere("quarter");
    const yearFilter = buildWhere("year");

    // ===== RUN PARALLEL QUERIES =====
    const [
      datesRes,
      empRes,
      funcRes,
      cwRes,
      monthRes,
      qRes,
      yRes
    ] = await Promise.all([

      pool.query(
        `SELECT ARRAY_AGG(
          DISTINCT TO_CHAR(work_date,'YYYY-MM-DD')
          ORDER BY TO_CHAR(work_date,'YYYY-MM-DD')
        ) AS dates
        FROM daily_data ${dateFilter.where}`,
        dateFilter.values
      ),

      pool.query(
        `SELECT ARRAY_AGG(DISTINCT employee_name ORDER BY employee_name) AS employees
        FROM daily_data ${employeeFilter.where}`,
        employeeFilter.values
      ),

      pool.query(
        `SELECT ARRAY_AGG(DISTINCT function_name ORDER BY function_name) AS functions
        FROM daily_data ${functionFilter.where}`,
        functionFilter.values
      ),

      pool.query(
        `SELECT ARRAY_AGG(DISTINCT cw ORDER BY cw) AS cws
        FROM daily_data ${cwFilter.where}`,
        cwFilter.values
      ),

      pool.query(
        `SELECT ARRAY_AGG(DISTINCT month ORDER BY month) AS months
        FROM daily_data ${monthFilter.where}`,
        monthFilter.values
      ),

      pool.query(
        `SELECT ARRAY_AGG(DISTINCT quarter ORDER BY quarter) AS quarters
        FROM daily_data ${quarterFilter.where}`,
        quarterFilter.values
      ),

      pool.query(
        `SELECT ARRAY_AGG(DISTINCT year ORDER BY year) AS years
        FROM daily_data ${yearFilter.where}`,
        yearFilter.values
      )

    ]);

    // ===== SEND RESPONSE =====
    res.json({
      dates: datesRes.rows[0].dates || [],
      employees: empRes.rows[0].employees || [],
      functions: funcRes.rows[0].functions || [],
      cws: cwRes.rows[0].cws || [],
      months: monthRes.rows[0].months || [],
      quarters: qRes.rows[0].quarters || [],
      years: yRes.rows[0].years || []
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dynamic values fetch failed" });
  }
});



router.get("/analytics", async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      dates,
      months,
      employeenames,
      functions,
      cws,
      quarters,
      years,
    } = req.query;

    let conditions = [];
    let values = [];
    let index = 1;

    const addArrayFilter = (field, data) => {
  if (!data) return;

  let arr = data
    .split(",")
    .filter(v => v !== "" && v !== null);  // 🔥 REMOVE EMPTY STRINGS

  if (arr.length === 0) return;           // 🔥 STOP IF EMPTY

  if (field === "work_date") {
    conditions.push(`${field}::date = ANY($${index++}::date[])`);
    values.push(arr);
    return;
  }

  if (["cw", "quarter", "year"].includes(field)) {
    arr = arr.map(v => Number(v)).filter(v => !isNaN(v));
    if (arr.length === 0) return;
    conditions.push(`${field} = ANY($${index++}::int[])`);
    values.push(arr);
    return;
  }

  conditions.push(`${field} = ANY($${index++}::text[])`);
  values.push(arr);
};



    addArrayFilter("work_date", dates);
    addArrayFilter("month", months);
    addArrayFilter("employee_name", employeenames);
    addArrayFilter("function_name", functions);
    addArrayFilter("cw", cws);
    addArrayFilter("quarter", quarters);
    addArrayFilter("year", years);

    // ✅ DATE RANGE FILTER
   if (fromDate && fromDate !== "" &&toDate && toDate !== "")  {
      conditions.push(
        `work_date BETWEEN $${index++} AND $${index++}`
      );
      values.push(fromDate, toDate);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // ===== 1. SUM EFFICIENCY BY DATE =====
    const dateQuery = `
      SELECT
        TO_CHAR(work_date, 'YYYY-MM-DD') AS work_date,
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
        AVG(efficiency) AS avg_efficiency,
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
      ${where}
      GROUP BY month
      ORDER BY month_order
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