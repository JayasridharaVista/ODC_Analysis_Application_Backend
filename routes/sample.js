// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const xlsx = require("xlsx");
// const pool = require("../db");
// const upload = multer({ dest: "uploads/" });



// // 2. Fetch Data for the React Dashboard

// router.post("/upload", upload.single("file"), async (req, res) => {
//   try {
//     const workbook = xlsx.readFile(req.file.path);

//     // Detect sheet that likely contains the tabular data (look for common headers)
//     const targetKeys = ["date", "cw", "efficiency", "employee"];
//     let chosenSheetName = req.body.sheetName || workbook.SheetNames[0];
//       let rawData = [];

//    if (req.body.sheetName) {
//   const sheet = workbook.Sheets[req.body.sheetName];

//   if (!sheet) {
//     return res.status(400).json({
//       error: `Sheet '${req.body.sheetName}' not found`,
//       availableSheets: workbook.SheetNames
//     });
//   }

//   rawData = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });

// } 

//     for (const name of workbook.SheetNames) {
//       const sheet = workbook.Sheets[name];
//       const sheetJson = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
//       if (sheetJson && sheetJson.length) {
//         const keys = Object.keys(sheetJson[0]).map(k => (k || "").toString().toLowerCase());
//         const matches = targetKeys.some(t => keys.some(k => k.includes(t)));
//         if (matches) {
//           chosenSheetName = name;
//           rawData = sheetJson;
//           break;
//         }
//       }
//     }

//     // Fallback to first sheet if detection didn't set rawData
//     if (!rawData.length) {
//       const sheet = workbook.Sheets[workbook.SheetNames[0]];
//       rawData = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
//     }

//     // Log helpful debug info
//     console.log("Chosen sheet:", chosenSheetName);
//     if (rawData && rawData.length) console.log("Sample headers:", Object.keys(rawData[0]));

//     // Helper to find a value by checking possible header name variants (case-insensitive)
//     // normalize by removing non-alphanumeric characters so things like '/', '-', misspellings, or extra spaces are ignored
//     const normalize = s => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
//     const findVal = (row, variants) => {
//       if (!row) return null;
//       const keys = Object.keys(row || {});
//       const normKeys = keys.map(k => ({ raw: k, norm: normalize(k) }));
//       for (const v of variants) {
//         const nv = normalize(v);
//         const found = normKeys.find(k => k.norm.includes(nv) || nv.includes(k.norm));
//         if (found) return row[found.raw];
//       }
//       return null;
//     };

//     // Define aliases for each expected column
//     const aliases = {
//       cw: ["cw", "calendarweek", "calendar week", "week"],
//       work_date: ["date", "workdate", "work date", "day"],
//       quarter: ["quarter"],
//       month: ["month"],
//       year: ["year"],
//       employee_number: ["vistaemployeenumber", "vista employee number", "employee number", "empno", "employee_number"],
//       employee_name: ["employee name", "name", "employee_name"],
//       attendance: ["attendance"],
//       function_name: ["function", "function name", "function_name"],
//       task: ["task"],
//       achieved_frames: [
//         "acheived frames/images",
//         "achieved frames",
//         "acheived frames",
//         "achieved_frames",
//         "achieved frames/images",
//         "expected frames/images",
//         "expectedframesimages",
//         "expectedframes",
//       ],
//       employee_status: ["employee status", "status"],
//       sub_function: ["sub-function", "sub function", "subfunction"],
//       factor: ["factor"],
//       expected_id: ["expected id", "expectedid", "expected id(s)", "expected id(s)"],
//       achevied_id: ["achevied id", "achieved id", "acheviedid", "achievedid"],
//       expected_labels: ["expected labels", "expectedlabels"],
//       achevied_labels: ["achevied labels", "achieved labels", "acheviedlabels", "achievedlabels"],
//       effort: ["effort"],
//       efficiency: ["efficiency", "eff" ]
//     };

//     const data = rawData.map(row => {
//       const rawDate = findVal(row, aliases.work_date);
//       let work_date = null;
//       if (rawDate instanceof Date) work_date = rawDate;
//       else if (rawDate) {
//         const parsed = new Date(rawDate);
//         if (!isNaN(parsed)) work_date = parsed;
//         else work_date = null;
//       }

//       const numOrNull = v => {
//         if (v === null || v === undefined || v === "") return null;
//         const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
//         return Number.isFinite(n) ? n : null;
//       };

//       return {
//         cw: findVal(row, aliases.cw),
//         work_date,
//         quarter: findVal(row, aliases.quarter),
//         month: findVal(row, aliases.month),
//         year: findVal(row, aliases.year),
//         employee_number: findVal(row, aliases.employee_number),
//         employee_name: findVal(row, aliases.employee_name),
//         employee_status: findVal(row, aliases.employee_status),
//         attendance: findVal(row, aliases.attendance),
//         function_name: findVal(row, aliases.function_name),
//         sub_function: findVal(row, aliases.sub_function),
//         task: findVal(row, aliases.task),
//         factor: findVal(row, aliases.factor),
//         achieved_frames: numOrNull(findVal(row, aliases.achieved_frames)),
//         effort: numOrNull(findVal(row, aliases.effort)),
//         expected_id: findVal(row, aliases.expected_id),
//         achevied_id: findVal(row, aliases.achevied_id),
//         expected_labels: findVal(row, aliases.expected_labels),
//         achevied_labels: findVal(row, aliases.achevied_labels),
//         efficiency: numOrNull(findVal(row, aliases.efficiency))
//       };
//     });

//     // If the chosen sheet looks like an aggregate (e.g. pivot summary) instead of raw rows,
//     // abort early with a helpful message so the user can upload/select the detailed sheet.
//     const sampleHeaders = rawData && rawData.length ? Object.keys(rawData[0]).map(h => normalize(h)) : [];
//     const looksLikeAggregate = sampleHeaders.length === 2 && sampleHeaders.includes("rowlabels") && sampleHeaders.includes("sumofefficiency");
//     if (looksLikeAggregate) {
//       console.warn("Upload appears to be an aggregate sheet. Headers:", Object.keys(rawData[0]));
//       return res.status(400).json({ error: "Uploaded sheet appears to be an aggregate (Row Labels / Sum of Efficiency). Please upload the detailed raw data sheet (Date, VISTA Employee number, Acheived Frames/Images, Effort, Efficiency, etc.).", headers: Object.keys(rawData[0]) });
//     }

//     // Get actual columns present in the DB table so we only insert columns that exist
//     const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_data'");
//     const existingCols = colRes.rows.map(r => r.column_name);

//     let inserted = 0;
//     for (const row of data) {
//       // select keys that both exist in the parsed row and in the DB
//       const keys = Object.keys(row).filter(k => existingCols.includes(k));
//       if (!keys.length) {
//         console.warn("Skipping row because no matching DB columns:", row);
//         continue;
//       }

//       const colsStr = keys.join(", ");
//       const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
//       const values = keys.map(k => row[k]);
//       const q = `INSERT INTO daily_data (${colsStr}) VALUES (${placeholders})`;
//       try {
//         await pool.query(q, values);
//         inserted += 1;
//       } catch (err) {
//         console.error("Failed to insert row", { q, values, err });
//       }
//     }

//     res.json({ message: `Data import complete. Rows inserted: ${inserted}` });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Upload failed" });
//   }
// });


// // Preview parsed rows without inserting. Accepts optional `sheetName` in body/form to override detection.
// router.post("/upload/preview", upload.single("file"), async (req, res) => {
//   try {
//     const workbook = xlsx.readFile(req.file.path);
//     const targetKeys = ["date", "cw", "efficiency", "employee"];
//     let chosenSheetName = req.body && req.body.sheetName ? req.body.sheetName : workbook.SheetNames[0];
//     let rawData = [];

//     if (req.body && req.body.sheetName) {
//       // honor override if provided
//       const sheet = workbook.Sheets[req.body.sheetName];
//       if (!sheet) return res.status(400).json({ error: `Sheet name '${req.body.sheetName}' not found` });
//       rawData = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
//     } else {
//       // auto-detect as before
//       for (const name of workbook.SheetNames) {
//         const sheet = workbook.Sheets[name];
//         const sheetJson = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
//         if (sheetJson && sheetJson.length) {
//           const keys = Object.keys(sheetJson[0]).map(k => (k || "").toString().toLowerCase());
//           const matches = targetKeys.some(t => keys.some(k => k.includes(t)));
//           if (matches) {
//             chosenSheetName = name;
//             rawData = sheetJson;
//             break;
//           }
//         }
//       }

//       if (!rawData.length) {
//         const sheet = workbook.Sheets[workbook.SheetNames[0]];
//         rawData = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
//       }
//     }

//     // reuse normalization/helpers from upload route
//     const normalize = s => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
//     const findVal = (row, variants) => {
//       if (!row) return null;
//       const keys = Object.keys(row || {});
//       const normKeys = keys.map(k => ({ raw: k, norm: normalize(k) }));
//       for (const v of variants) {
//         const nv = normalize(v);
//         const found = normKeys.find(k => k.norm.includes(nv) || nv.includes(k.norm));
//         if (found) return row[found.raw];
//       }
//       return null;
//     };

//     const aliases = {
//       cw: ["cw", "calendarweek", "calendar week", "week"],
//       work_date: ["date", "workdate", "work date", "day"],
//       quarter: ["quarter"],
//       month: ["month"],
//       year: ["year"],
//       employee_number: ["vistaemployeenumber", "vista employee number", "employee number", "empno", "employee_number"],
//       employee_name: ["employee name", "name", "employee_name"],
//       attendance: ["attendance"],
//       function_name: ["function", "function name", "function_name"],
//       task: ["task"],
//       achieved_frames: ["acheived frames/images","achieved frames","acheived frames","achieved_frames","achieved frames/images","expected frames/images","expectedframesimages","expectedframes"],
//       employee_status: ["employee status", "status"],
//       sub_function: ["sub-function", "sub function", "subfunction"],
//       factor: ["factor"],
//       expected_id: ["expected id", "expectedid", "expected id(s)", "expected id(s)"],
//       achevied_id: ["achevied id", "achieved id", "acheviedid", "achievedid"],
//       expected_labels: ["expected labels", "expectedlabels"],
//       achevied_labels: ["achevied labels", "achieved labels", "acheviedlabels", "achievedlabels"],
//       effort: ["effort"],
//       efficiency: ["efficiency", "eff" ]
//     };

//     const numOrNull = v => {
//       if (v === null || v === undefined || v === "") return null;
//       const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
//       return Number.isFinite(n) ? n : null;
//     };

//     const mapped = (rawData || []).map(row => ({
//       cw: findVal(row, aliases.cw),
//       work_date: (() => { const d = findVal(row, aliases.work_date); const p = d instanceof Date ? d : (d ? new Date(d) : null); return (!p || isNaN(p)) ? null : p; })(),
//       quarter: findVal(row, aliases.quarter),
//       month: findVal(row, aliases.month),
//       year: findVal(row, aliases.year),
//       employee_number: findVal(row, aliases.employee_number),
//       employee_name: findVal(row, aliases.employee_name),
//       employee_status: findVal(row, aliases.employee_status),
//       attendance: findVal(row, aliases.attendance),
//       function_name: findVal(row, aliases.function_name),
//       sub_function: findVal(row, aliases.sub_function),
//       task: findVal(row, aliases.task),
//       factor: findVal(row, aliases.factor),
//       achieved_frames: numOrNull(findVal(row, aliases.achieved_frames)),
//       effort: numOrNull(findVal(row, aliases.effort)),
//       expected_id: findVal(row, aliases.expected_id),
//       achevied_id: findVal(row, aliases.achevied_id),
//       expected_labels: findVal(row, aliases.expected_labels),
//       achevied_labels: findVal(row, aliases.achevied_labels),
//       efficiency: numOrNull(findVal(row, aliases.efficiency))
//     }));

//     const preview = mapped.slice(0, 10);
//     const sampleHeaders = rawData && rawData.length ? Object.keys(rawData[0]) : [];
//     res.json({ chosenSheetName, sampleHeaders, preview });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Preview failed' });
//   }
// });

// // Return sheet names present in the uploaded workbook so client can choose which to preview/import
// router.post("/upload/sheets", upload.single("file"), async (req, res) => {
//   try {
//     const workbook = xlsx.readFile(req.file.path);
//     res.json({ sheets: workbook.SheetNames });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to read workbook' });
//   }
// });


// router.get("/stats", async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT work_date, AVG(efficiency) as avg_efficiency 
//       FROM daily_data 
//       GROUP BY work_date 
//       ORDER BY work_date ASC
//     `);
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).send("Server Error");
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const pool = require("../db");

const upload = multer({ dest: "uploads/" });

/* ============================
   UPLOAD EXCEL → INSERT DATA
============================ */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = xlsx.readFile(req.file.path);

    let chosenSheetName = null;
    let rawData = [];

    /* ----------------------------
       SHEET SELECTION LOGIC
    ---------------------------- */

    // If sheetName provided → use it
    if (req.body.sheetName) {
      const sheet = workbook.Sheets[req.body.sheetName];

      if (!sheet) {
        return res.status(400).json({
          error: `Sheet '${req.body.sheetName}' not found`,
          availableSheets: workbook.SheetNames
        });
      }

      chosenSheetName = req.body.sheetName;
      rawData = xlsx.utils.sheet_to_json(sheet, {
        defval: null,
        raw: false
      });
    } else {
      // AUTO DETECT RAW DATA SHEET
      const targetKeys = ["date", "cw", "efficiency", "employee"];

      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        const sheetJson = xlsx.utils.sheet_to_json(sheet, {
          defval: null,
          raw: false
        });

        if (!sheetJson.length) continue;

        const keys = Object.keys(sheetJson[0]).map(k =>
          (k || "").toLowerCase()
        );

        const matches = targetKeys.some(t =>
          keys.some(k => k.includes(t))
        );

        if (matches) {
          chosenSheetName = name;
          rawData = sheetJson;
          break;
        }
      }

      // fallback first sheet
      if (!rawData.length) {
        chosenSheetName = workbook.SheetNames[0];
        rawData = xlsx.utils.sheet_to_json(
          workbook.Sheets[chosenSheetName],
          { defval: null, raw: false }
        );
      }
    }

    console.log("Chosen sheet:", chosenSheetName);

    /* ----------------------------
       HELPER FUNCTIONS
    ---------------------------- */

    const normalize = s =>
      (s || "")
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const findVal = (row, variants) => {
      const keys = Object.keys(row || {});
      const normKeys = keys.map(k => ({
        raw: k,
        norm: normalize(k)
      }));

      for (const v of variants) {
        const nv = normalize(v);
        const found = normKeys.find(
          k => k.norm.includes(nv) || nv.includes(k.norm)
        );
        if (found) return row[found.raw];
      }
      return null;
    };

    /* ----------------------------
       COLUMN ALIASES
    ---------------------------- */

    const aliases = {
      cw: ["cw", "calendarweek", "week"],
      work_date: ["date", "workdate", "day"],
      quarter: ["quarter"],
      month: ["month"],
      year: ["year"],
      employee_number: ["vistaemployeenumber", "employee number", "empno"],
      employee_name: ["employee name", "name"],
      attendance: ["attendance"],
      function_name: ["function", "function name"],
      task: ["task"],
      achieved_frames: ["achieved frames", "acheived frames", "achieved_frames"],
      employee_status: ["employee status", "status"],
      sub_function: ["sub-function", "sub function"],
      factor: ["factor"],
      expected_id: ["expected id"],
      achevied_id: ["achieved id"],
      expected_labels: ["expected labels"],
      achevied_labels: ["achieved labels"],
      effort: ["effort"],
      efficiency: ["efficiency", "eff"]
    };

    const numOrNull = v => {
      if (!v) return null;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    const data = rawData.map(row => ({
      cw: findVal(row, aliases.cw),
      work_date: new Date(findVal(row, aliases.work_date)),
      quarter: findVal(row, aliases.quarter),
      month: findVal(row, aliases.month),
      year: findVal(row, aliases.year),
      employee_number: findVal(row, aliases.employee_number),
      employee_name: findVal(row, aliases.employee_name),
      employee_status: findVal(row, aliases.employee_status),
      attendance: findVal(row, aliases.attendance),
      function_name: findVal(row, aliases.function_name),
      sub_function: findVal(row, aliases.sub_function),
      task: findVal(row, aliases.task),
      factor: findVal(row, aliases.factor),
      achieved_frames: numOrNull(findVal(row, aliases.achieved_frames)),
      effort: numOrNull(findVal(row, aliases.effort)),
      expected_id: findVal(row, aliases.expected_id),
      achevied_id: findVal(row, aliases.achevied_id),
      expected_labels: findVal(row, aliases.expected_labels),
      achevied_labels: findVal(row, aliases.achevied_labels),
      efficiency: numOrNull(findVal(row, aliases.efficiency))
    }));

    /* ----------------------------
       PIVOT SHEET PROTECTION
    ---------------------------- */

    const headers =
      rawData.length > 0
        ? Object.keys(rawData[0]).map(h => normalize(h))
        : [];

    if (
      headers.includes("rowlabels") &&
      headers.includes("sumofefficiency")
    ) {
      return res.status(400).json({
        error:
          "Pivot sheet detected. Upload RAW DATA sheet instead."
      });
    }

    /* ----------------------------
       INSERT INTO DATABASE
    ---------------------------- */

    const colRes = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='daily_data'"
    );

    const existingCols = colRes.rows.map(r => r.column_name);

    let inserted = 0;

    for (const row of data) {
      const keys = Object.keys(row).filter(k =>
        existingCols.includes(k)
      );

      if (!keys.length) continue;

      const cols = keys.join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map(k => row[k]);

      await pool.query(
        `INSERT INTO daily_data (${cols}) VALUES (${placeholders})`,
        values
      );

      inserted++;
    }

    res.json({
      message: `Data import complete. Rows inserted: ${inserted}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ============================
   GET SHEET NAMES
============================ */
router.post("/upload/sheets", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    res.json({ sheets: workbook.SheetNames });
  } catch (err) {
    res.status(500).json({ error: "Failed to read workbook" });
  }
});

/* ============================
   STATS API
============================ */
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

module.exports = router;


// router.get("/analytics", async (req, res) => {
//   try {
//     const {
//       date,
//       month,
//       employeename,
//       function: fn,
//       cw,
//       quarter,
//       year
//     } = req.query;

//     let conditions = [];
//     let values = [];
//     let index = 1;

//     if (date) {
//       conditions.push(`work_date = $${index++}`);
//       values.push(date);
//     }

//     if (month) {
//       conditions.push(`month = $${index++}`);
//       values.push(month);
//     }

//     if (employeename) {
//       conditions.push(`employee_name = $${index++}`);
//       values.push(employeename);
//     }

//     if (fn) {
//       conditions.push(`function_name = $${index++}`);
//       values.push(fn);
//     }

//     if (cw) {
//       conditions.push(`cw = $${index++}`);
//       values.push(cw);
//     }

//     if (quarter) {
//       conditions.push(`quarter = $${index++}`);
//       values.push(quarter);
//     }

//     if (year) {
//       conditions.push(`year = $${index++}`);
//       values.push(year);
//     }

//     const where = conditions.length
//       ? `WHERE ${conditions.join(" AND ")}`
//       : "";

//     const query = `
//       SELECT
//         COALESCE(SUM(efficiency),0) as sum_efficiency,
//         COALESCE(AVG(efficiency),0) as avg_efficiency,
//         COUNT(attendance) as attendance_count
//       FROM daily_data
//       ${where}
//     `;

//     const result = await pool.query(query, values);

//     res.json(result.rows[0]);

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Analytics fetch failed" });
//   }
// });
