# MongoDB & Mongoose Comprehensive Guide
### Database Systems Lab (BCSE302P) &bull; ApexCare Hospital Appointment Management System

This guide explains all database concepts used in the Hospital Appointment Management System in beginner-friendly language, specifically tailored for B.Tech Computer Science students presenting to professors and lab evaluators.

---

## 1. Core MongoDB Architecture: Database vs Collection vs Document

In relational databases (like MySQL), data is stored in **Tables**, **Rows**, and **Columns**. In MongoDB (a NoSQL document database), data is stored in flexible, JSON-like documents called **BSON** (Binary JSON).

| Relational Term (SQL) | MongoDB Term (NoSQL) | Description in this Project |
| :--- | :--- | :--- |
| **Database** | **Database** | `hospital_management` (the top-level container) |
| **Table** | **Collection** | `patients`, `doctors`, `departments`, `appointments`, `admins` |
| **Row / Record** | **Document** | An individual patient record, doctor profile, or appointment |
| **Column** | **Field** | An attribute within a document, e.g., `email`, `phone`, `specialization` |
| **Foreign Key / JOIN** | **Reference & `$lookup`** | Linking `patientId` and `doctorId` inside an appointment document |

### Visual Document Structure Example:
```json
{
  "_id": ObjectId("67098e9b43fa89d41b52aa10"),
  "name": "Dr. Rajesh Sharma",
  "email": "dr.rajesh@hospital.com",
  "specialization": "Senior Interventional Cardiologist",
  "departmentId": ObjectId("67098e9b43fa89d41b52aa01"),
  "experienceYears": 16,
  "consultationFee": 900,
  "availability": "active",
  "createdAt": ISODate("2026-10-12T10:00:00Z")
}
```

---

## 2. MongoDB ObjectIds Explained

Every document created in MongoDB receives an automatically generated `_id` field of type `ObjectId`.

An `ObjectId` is a 12-byte binary value represented as a 24-character hexadecimal string:
```
67098e9b 43fa89 d41b 52aa10
[4 bytes: Timestamp] [3 bytes: Machine ID] [2 bytes: Process ID] [3 bytes: Incremental Counter]
```

### Why ObjectIds Are Better Than Auto-Increment Integers:
1. **Globally Unique:** Generated on client/server without needing centralized coordination or table locking.
2. **Built-in Timestamp:** You can extract the exact creation time directly from `_id.getTimestamp()`.
3. **Natural Sorting:** Documents are naturally ordered roughly in chronological creation sequence.

---

## 3. Mongoose Schemas & Models

While raw MongoDB is schema-less (any document can have any shape), in enterprise applications like hospitals, data integrity is paramount. **Mongoose** provides an Object Data Modeling (ODM) layer on top of Node.js that enforces:
- Type casting (`String`, `Number`, `Date`, `ObjectId`, `Boolean`)
- Required fields (`required: [true, '...']`)
- Default values (`default: 'Booked'`)
- Format regex validation (`match: [/^\S+@\S+\.\S+$/]`)
- Custom methods (e.g., `patient.comparePassword(...)`)

### Example: Defining the Appointment Schema
```javascript
const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  appointmentDate: { type: Date, required: true },
  appointmentDateString: { type: String, required: true },
  appointmentTime: { type: String, required: true },
  reason: { type: String, required: true, minlength: 3, maxlength: 500 },
  status: { type: String, enum: ['Booked', 'Completed', 'Cancelled'], default: 'Booked' }
}, { timestamps: true });
```

---

## 4. Normalization vs References: How Relationships Work

In this system, we intentionally use **Normalized References** instead of embedding entire patient/doctor documents inside each appointment.

### Why References Over Embedding?
If a doctor changes their phone number or consultation fee, having their full data duplicated across 1,000 appointment documents would cause update anomalies. By storing only the `doctorId` reference (foreign key concept), updating the doctor in the `doctors` collection reflects instantly everywhere!

### Populating Relationships in Mongoose:
```javascript
const appointments = await Appointment.find({ patientId: currentUserId })
  .populate('doctorId', 'name specialization consultationFee')
  .populate('departmentId', 'departmentName icon')
  .sort({ appointmentDate: -1 });
```
Mongoose performs an internal secondary query matching the ObjectIds and returns a cleanly populated response tree.

---

## 5. MongoDB CRUD Operations in This Project

### 1. Create (Insert)
```javascript
// Registering a new patient
const patient = await Patient.create({
  name: "Rahul Verma",
  email: "rahul.verma@example.com",
  phone: "+91 9912345678",
  passwordHash: hashedPassword
});
```

### 2. Read (Query with Filters & Projections)
```javascript
// Searching active doctors in Cardiology with pagination
const doctors = await Doctor.find({
  departmentId: cardiologyDeptId,
  availability: 'active',
  name: { $regex: /sharma/i }
})
.select('-passwordHash') // Security: Exclude password hashes
.sort({ name: 1 })
.skip(0)
.limit(10);
```

### 3. Update (Document Modification)
```javascript
// Completing an appointment with doctor prescription
const updatedApp = await Appointment.findByIdAndUpdate(
  appointmentId,
  {
    $set: {
      status: 'Completed',
      consultationNotes: 'BP normal. Mild allergic rhinitis.',
      prescription: 'Levocetirizine 5mg once daily at bedtime.'
    }
  },
  { new: true, runValidators: true }
);
```

### 4. Delete / Deactivate (Preserving History)
```javascript
// Cancelling an appointment (soft audit update preserves history for reports)
appointment.status = 'Cancelled';
appointment.cancelledReason = 'Patient rescheduled travel';
appointment.cancelledBy = 'Patient';
appointment.cancelledAt = new Date();
await appointment.save();
```

---

## 6. MongoDB Indexes and Double-Booking Prevention

Indexes are specialized B-Tree data structures that allow MongoDB to find documents without performing a slow Collection Scan (`COLLSCAN`).

### Indexes Implemented in This System:
1. **Unique Email Indexes:**
   ```javascript
   patientSchema.index({ email: 1 }, { unique: true });
   doctorSchema.index({ email: 1 }, { unique: true });
   adminSchema.index({ email: 1 }, { unique: true });
   ```
2. **Text Search Index:**
   ```javascript
   doctorSchema.index({ name: 'text', specialization: 'text' });
   ```
3. **Compound Partial Unique Index for Conflict Prevention:**
   ```javascript
   appointmentSchema.index(
     { doctorId: 1, appointmentDateString: 1, appointmentTime: 1 },
     {
       unique: true,
       partialFilterExpression: { status: 'Booked' },
       name: 'unique_active_doctor_slot'
     }
   );
   ```

### How the Partial Index Prevents Double-Booking:
- **Condition:** No two documents can have the identical `doctorId`, `appointmentDateString`, and `appointmentTime` **WHILE** `status === 'Booked'`.
- If two patients click "Book" simultaneously for the same doctor at 10:00 AM on 2026-11-20, the second write is rejected by MongoDB with `MongoServerError: E11000 duplicate key error`.
- When an appointment is `Cancelled`, its status changes to `'Cancelled'`. Because the partialFilterExpression only applies to `'Booked'` status, the cancelled appointment drops out of the index, **automatically freeing that slot for other patients!**

---

## 7. MongoDB Aggregation Pipelines & `$lookup`

Aggregation pipelines process documents through multi-stage stages (`$match`, `$lookup`, `$unwind`, `$group`, `$project`, `$sort`).

### Aggregation 1: Grouping Appointments by Status (Admin Dashboard)
```javascript
const statusCounts = await Appointment.aggregate([
  {
    $group: {
      _id: '$status',       // Group by status field ('Booked', 'Completed', 'Cancelled')
      count: { $sum: 1 }    // Increment counter by 1 for each matching document
    }
  }
]);
```

### Aggregation 2: Joining Appointments with Departments using `$lookup`
```javascript
const deptDistribution = await Appointment.aggregate([
  // Stage 1: Join with departments collection
  {
    $lookup: {
      from: 'departments',
      localField: 'departmentId',
      foreignField: '_id',
      as: 'departmentDetails'
    }
  },
  // Stage 2: Deconstruct departmentDetails array into single object
  {
    $unwind: {
      path: '$departmentDetails',
      preserveNullAndEmptyArrays: true
    }
  },
  // Stage 3: Group by Department Name and sum appointments
  {
    $group: {
      _id: '$departmentDetails.departmentName',
      count: { $sum: 1 }
    }
  },
  // Stage 4: Project and rename fields for clean frontend consumption
  {
    $project: {
      _id: 0,
      department: '$_id',
      appointments: '$count'
    }
  },
  // Stage 5: Sort descending by volume
  { $sort: { appointments: -1 } }
]);
```

---

## 8. How to Inspect Collections in MongoDB Compass

MongoDB Compass is the official GUI for MongoDB.

1. Launch **MongoDB Compass** on your Windows laptop.
2. In the connection bar, enter:
   ```text
   mongodb://127.0.0.1:27017
   ```
   (Or paste your MongoDB Atlas Connection String if using Atlas).
3. Click **Connect**.
4. In the left sidebar, click the database: **`hospital_management`**.
5. You will see five collections:
   - `patients`
   - `doctors`
   - `departments`
   - `appointments`
   - `admins`
6. Click `appointments` &bull; Click **Indexes** tab to observe the compound partial unique index `unique_active_doctor_slot`.
7. Click the **Aggregations** tab to test pipeline stages interactively!

---

## 9. Security Best Practices Implemented

1. **Password Hashing:** Passwords are never stored in plaintext. Bcrypt with a salt factor of 10 hashes all passwords.
2. **Stripping Hashes on Output:** Every Mongoose model implements `toJSON` stripping `passwordHash` so hashes can never leak in JSON API responses.
3. **NoSQL Injection Defense:** All queries sanitize regex input and cast ObjectIds strictly.
4. **Role Isolation:** Middleware verifies JWT signatures and ensures patients cannot inspect other patients' records or doctor consultation queues.
