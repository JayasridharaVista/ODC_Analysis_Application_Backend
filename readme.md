// router.post("/upload", upload.single("file"), async (req, res) => {
//   try {
//     const workbook = xlsx.readFile(req.file.path);

//     // ✅ choose correct sheet
//     const sheetName = workbook.SheetNames[1];

//     const sheet = workbook.Sheets[sheetName];

//     const data = xlsx.utils.sheet_to_json(sheet);


//     console.log(data); // should show real columns



//     const query = `
//       INSERT INTO daily_data
//       (cw, work_date, employee_name, attendance, achieved_frames, effort, efficiency)
//       VALUES ($1,$2,$3,$4,$5,$6,$7)
//     `;

//     for (let row of data) {
//       await pool.query(query, [
//         row["CW"],
//         row["Date"],
//         row["Employee name"],
//         row["Attendance"],
//         row["Acheived Frames/Images"],
//         row["Effort"],
//         row["Efficiency"]
//       ]);
//     }

//     res.json({ message: "Data imported successfully!" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to process file" });
//   }
// });


// router.get("/values", async (req, res) => {
//   try {
//     const {
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
//   if (!data) return;

//   let arr = data.split(",");

//   // convert numeric filters
//   if (["cw", "quarter", "year"].includes(field)) {
//     arr = arr.map(v => Number(v));
//   }

//   conditions.push(`${field} = ANY($${index++})`);
//   values.push(arr);
// };

//     addArrayFilter("work_date", dates);
//     addArrayFilter("month", months);
//     addArrayFilter("employee_name", employeenames);
//     addArrayFilter("function_name", functions);
//     addArrayFilter("cw", cws);
//     addArrayFilter("quarter", quarters);
//     addArrayFilter("year", years);

//     const where = conditions.length
//       ? `WHERE ${conditions.join(" AND ")}`
//       : "";

//     const query = `
//       SELECT
//         ARRAY_AGG(DISTINCT work_date) FILTER (WHERE work_date IS NOT NULL) AS dates,
//         ARRAY_AGG(DISTINCT employee_name) FILTER (WHERE employee_name IS NOT NULL) AS employees,
//         ARRAY_AGG(DISTINCT function_name) FILTER (WHERE function_name IS NOT NULL) AS functions,
//         ARRAY_AGG(DISTINCT cw) FILTER (WHERE cw IS NOT NULL) AS cws,
//         ARRAY_AGG(DISTINCT month) FILTER (WHERE month IS NOT NULL) AS months,
//         ARRAY_AGG(DISTINCT quarter) FILTER (WHERE quarter IS NOT NULL) AS quarters,
//         ARRAY_AGG(DISTINCT year) FILTER (WHERE year IS NOT NULL) AS years
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