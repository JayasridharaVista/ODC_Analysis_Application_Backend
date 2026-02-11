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