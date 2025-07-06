const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const guests = [];
const attended = new Set(); // لتتبع الحضور في الذاكرة

// قراءة قائمة المدعوين
fs.createReadStream("RESPONSES.csv")
  .pipe(csv())
  .on("data", (row) => {
    guests.push({
      name: row["الأسم الكامل"],
      email: row["عنوان البريد الإلكتروني"],
      phone: row["رقم الهاتف"],
      confirmed: row["هل انت متأكد من الحضور؟"]?.trim(),
    });
  })
  .on("end", () => {
    console.log(`تم تحميل ${guests.length} مدعو من الملف`);
  });

const attendedFile = "attended.csv";

// إنشاء ملف الحضور إذا لم يكن موجوداً
if (!fs.existsSync(attendedFile)) {
  fs.writeFileSync(attendedFile, "email,name,phone,time\n");
} else {
  // قراءة الحضور السابق عند تشغيل السيرفر
  fs.readFile(attendedFile, "utf8", (err, data) => {
    if (!err && data) {
      const lines = data.trim().split("\n");
      // تخطي الـ header واضافة البيانات للـ Set
      for (let i = 1; i < lines.length; i++) {
        const [email] = lines[i].split(",");
        if (email) {
          attended.add(email.toLowerCase());
        }
      }
      console.log(`تم تحميل ${attended.size} شخص من الحضور السابق`);
    }
  });
}

app.post("/check-in", (req, res) => {
  console.log("📩 استلمت من الفرونت:", req.body);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "يرجى إرسال البريد الإلكتروني" });
  }

  const guest = guests.find(
    (g) => g.email?.toLowerCase() === email.toLowerCase()
  );

  if (!guest) {
    return res
      .status(404)
      .json({ message: "هذا الشخص غير موجود في قائمة المدعوين" });
  }

  if (attended.has(email.toLowerCase())) {
    return res.status(409).json({
      message: "تم تسجيل هذا الشخص مسبقًا",
      count: attended.size,
    });
  }

  // سجل الحضور
  const line = `${guest.email},${guest.name},${
    guest.phone
  },${new Date().toISOString()}\n`;
  fs.appendFileSync(attendedFile, line);
  attended.add(email.toLowerCase());

  console.log(`✅ تم تسجيل ${guest.name} - العدد الآن: ${attended.size}`);

  return res.json({
    message: "✅ تم تسجيل الحضور بنجاح",
    guest,
    count: attended.size,
  });
});

app.get("/count", (req, res) => {
  // استخدام الـ Set بدلاً من قراءة الملف
  res.json({ count: attended.size });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
