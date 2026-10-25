# ApexCare Hospital Appointment Management System
# MongoDB Query Reference & Implementation Guide

> **Academic Course:** BCSE302P — Database Systems Lab  
> **Project Title:** ApexCare Hospital Appointment Management System  
> **Technology Stack:** Node.js, Express.js 5.3, MongoDB 9.0, Mongoose ODM 9.11  
> **Source Code Verified Date:** October 14, 2026  
> **Purpose:** Master reference of all MongoDB queries, aggregation pipelines, and index definitions actually implemented in the project codebase, with verified exact line numbers.

---

## Table of Contents
1. [Query Location Verification & Detailed Explanations](#1-query-location-verification--detailed-explanations)
   - [A. Appointment Queries (src/controllers/appointmentController.js)](#a-appointment-queries)
   - [B. Administrator Queries & Aggregation Pipelines (src/controllers/adminController.js)](#b-administrator-queries--aggregation-pipelines)
   - [C. Department Queries & Join Pipeline (src/controllers/departmentController.js)](#c-department-queries)
   - [D. Patient Dashboard Queries (src/controllers/patientController.js)](#d-patient-queries)
   - [E. Doctor Search & Metrics Queries (src/controllers/doctorController.js)](#e-doctor-queries)
   - [F. Dynamic Slot Availability Engine (src/services/slotService.js)](#f-time-slot-availability)
   - [G. Authentication & Session Queries (src/controllers/authController.js & src/middleware/auth.js)](#g-authentication-and-registration)
   - [H. Database Index Definitions (src/models/Appointment.js & Doctor.js)](#h-database-index-definitions)
2. [Master Query Reference Table](#2-master-query-reference-table)
3. [Crucial Review Distinction: Validation vs. Index vs. Transactions](#3-crucial-review-distinction-validation-vs-index-vs-transactions)

---

## 1. Query Location Verification & Detailed Explanations

---

### A. Appointment Queries
**File:** [`src/controllers/appointmentController.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js)

#### 1. Doctor Slot Conflict Pre-Check
- **Exact Lines:** [Lines 112–117](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L112-L117)
- **Original Code Excerpt:**
  ```javascript
  const existingConflict = await Appointment.findOne({
    doctorId: doctor._id,
    appointmentDateString: appointmentDate,
    appointmentTime,
    status: 'Booked'
  });
  ```
- **What It Does:** Queries MongoDB's `appointments` collection to check whether an active booking (`status: 'Booked'`) already exists for the same doctor, on the specified date string (`YYYY-MM-DD`), at the exact 30-minute time slot.
- **Input Example:** `{ doctorId: ObjectId("6709f..."), appointmentDateString: "2026-10-15", appointmentTime: "10:30", status: "Booked" }`
- **Output:** Returns the conflicting `Appointment` document if found, or `null` if the slot is free.
- **Why It Is Needed:** Provides an immediate application-level guard. If a document is found, the server immediately halts processing and returns `HTTP 409 Conflict` before performing database writes.
- **What to say in Viva:** *"Sir, this `findOne` query is our first layer of conflict defense. It prevents unnecessary write operations by verifying that the doctor does not already have an active appointment in that time slot."*

#### 2. Patient Overlapping Booking Conflict Check
- **Exact Lines:** [Lines 127–132](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L127-L132)
- **Original Code Excerpt:**
  ```javascript
  const patientConflict = await Appointment.findOne({
    patientId: targetPatientId,
    appointmentDateString: appointmentDate,
    appointmentTime,
    status: 'Booked'
  });
  ```
- **What It Does:** Ensures a single patient cannot book two different appointments (even across different doctors or departments) at the exact same date and time.
- **Why It Is Needed:** Enforces real-world medical scheduling sanity and prevents accidental double-submissions by the patient.
- **What to say in Viva:** *"Sir, this prevents a patient from booking two different consultations at the exact same hour."*

#### 3. Inserting the Appointment Document
- **Exact Lines:** [Lines 146–155](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L146-L155)
- **Original Code Excerpt:**
  ```javascript
  const appointment = await Appointment.create({
    patientId: targetPatientId,
    doctorId: doctor._id,
    departmentId: doctor.departmentId._id,
    appointmentDate: parsedDate,
    appointmentDateString: appointmentDate,
    appointmentTime,
    reason: reason.trim(),
    status: 'Booked'
  });
  ```
- **What It Does:** Atomically writes a new document into the `appointments` collection. Also triggers MongoDB's unique index validation.
- **Input Example:** Object containing BSON ObjectIds for `patientId`, `doctorId`, and `departmentId`, UTC `Date`, formatted string date, and visit reason.
- **Output:** The newly created Mongoose document containing generated `_id` and timestamps (`createdAt`, `updatedAt`).
- **Why It Is Needed:** This is the core transactional insert of our application. If two requests slip past the `findOne` check simultaneously, MongoDB's unique index catches it here and throws error code `11000`.
- **What to say in Viva:** *"Sir, `Appointment.create()` executes the atomic insert into MongoDB. Notice that we denormalize `departmentId` directly into the appointment to speed up future department-level aggregation reports."*

#### 4. Reference Population (`.populate()`)
- **Exact Lines:** [Lines 157–160](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L157-L160) (single create) & [Lines 209–213](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L209-L213) (list)
- **Original Code Excerpt:**
  ```javascript
  const populated = await Appointment.findById(appointment._id)
    .populate('patientId', 'name email phone gender')
    .populate('doctorId', 'name specialization consultationFee')
    .populate('departmentId', 'departmentName');
  ```
- **What It Does:** Performs client-side reference resolution by taking the stored `ObjectId` values and issuing secondary find queries behind the scenes to replace the IDs with actual document fields.
- **Input:** Document with `{ patientId: ObjectId("..."), doctorId: ObjectId("...") }`.
- **Output:** Document with nested objects `{ patientId: { name: "John Doe", email: "..." }, doctorId: { name: "Dr. Sharma" } }`.
- **Why It Is Needed:** Because MongoDB is non-relational, normalized collections store only IDs. `.populate()` hydrates those IDs into human-readable details for the frontend confirmation screen.
- **What to say in Viva:** *"Sir, `.populate()` is Mongoose's join abstraction. It replaces stored BSON ObjectIds with the actual referenced documents from the Patients, Doctors, and Departments collections."*

#### 5. Role-Scoped Paginated Appointment Query
- **Exact Lines:** [Lines 207–215](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L207-L215)
- **Original Code Excerpt:**
  ```javascript
  const total = await Appointment.countDocuments(filter);

  const appointments = await Appointment.find(filter)
    .populate('patientId', 'name email phone gender bloodGroup')
    .populate('doctorId', 'name specialization consultationFee')
    .populate('departmentId', 'departmentName icon')
    .sort(sort === 'date' ? { appointmentDateString: -1, appointmentTime: -1 } : { createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  ```
- **What It Does:** First calculates total matching records with `countDocuments(filter)`. Then retrieves a page of appointments using `.skip()` and `.limit()`, sorted chronologically, while isolating data by role (patients only see their own `patientId`, doctors only see their assigned `doctorId`).
- **Why It Is Needed:** Prevents memory exhaustion when retrieving thousands of records and enforces security isolation between users.
- **What to say in Viva:** *"Sir, we use `countDocuments()` alongside `.skip()` and `.limit()` to implement database-level pagination, while the `filter` object enforces strict data isolation based on JWT user roles."*

#### 6. Rescheduling Conflict Check with `$ne` (Not Equal)
- **Exact Lines:** [Lines 346–352](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L346-L352)
- **Original Code Excerpt:**
  ```javascript
  const conflict = await Appointment.findOne({
    _id: { $ne: appointment._id },
    doctorId: appointment.doctorId,
    appointmentDateString: newDate,
    appointmentTime: newTime,
    status: 'Booked'
  });
  ```
- **What It Does:** Checks whether another appointment occupies the desired slot, explicitly excluding the current appointment using MongoDB's `$ne` (Not Equal) operator.
- **Why It Is Needed:** If an appointment is being updated, it must not compare against itself, but must prevent taking a slot already occupied by another patient.
- **What to say in Viva:** *"Sir, the `$ne` operator is critical during rescheduling. It tells MongoDB: 'Check if ANY document OTHER than this appointment is already booked at that slot'."*

#### 7. Soft Cancellation via `.save()`
- **Exact Lines:** [Lines 437–442](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L437-L442)
- **Original Code Excerpt:**
  ```javascript
  appointment.status = 'Cancelled';
  appointment.cancelledReason = reason || 'Cancelled by user';
  appointment.cancelledBy = req.user.role === 'patient' ? 'Patient' : req.user.role === 'doctor' ? 'Doctor' : 'Admin';
  appointment.cancelledAt = new Date();

  await appointment.save();
  ```
- **What It Does:** Changes document status from `'Booked'` to `'Cancelled'`, attaches audit metadata, and persists changes with Mongoose's `.save()`.
- **Why It Is Needed:** We do NOT delete records from MongoDB (`deleteOne`). Retaining the document preserves medical audit history while instantly freeing the slot because of our partial index filter!
- **What to say in Viva:** *"Sir, we use soft cancellation rather than hard deletion. Changing status to 'Cancelled' preserves historical records while automatically releasing the slot from our partial unique index."*

---

### B. Administrator Queries & Aggregation Pipelines
**File:** [`src/controllers/adminController.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js)

#### 1. Parallel Collection Counts via `countDocuments()`
- **Exact Lines:** [Lines 15–21](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L15-L21)
- **Original Code Excerpt:**
  ```javascript
  const [totalPatients, totalDoctors, activeDoctors, totalDepartments, totalAppointments] = await Promise.all([
    Patient.countDocuments(),
    Doctor.countDocuments(),
    Doctor.countDocuments({ availability: 'active' }),
    Department.countDocuments(),
    Appointment.countDocuments()
  ]);
  ```
- **What It Does:** Dispatches 5 concurrent count operations to MongoDB using `Promise.all()`.
- **Why It Is Needed:** Provides real-time dashboard figures without blocking sequentially.
- **What to say in Viva:** *"Sir, `Promise.all()` sends concurrent `countDocuments()` queries over the connection pool to fetch hospital summary statistics in parallel."*

#### 2. Status Distribution Aggregation (`$group` + `$sum`)
- **Exact Lines:** [Lines 24–31](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L24-L31)
- **Original Code Excerpt:**
  ```javascript
  const statusAggregation = await Appointment.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  ```
- **Pipeline Stages:**
  - `$group`: Groups all appointment documents by their `$status` field (`'Booked'`, `'Completed'`, `'Cancelled'`).
  - `count: { $sum: 1 }`: Increments a counter by 1 for every document matching that group accumulator.
- **Input Documents:**
  ```json
  [
    { "status": "Booked" },
    { "status": "Booked" },
    { "status": "Completed" },
    { "status": "Cancelled" }
  ]
  ```
- **Output Documents:**
  ```json
  [
    { "_id": "Booked", "count": 2 },
    { "_id": "Completed", "count": 1 },
    { "_id": "Cancelled", "count": 1 }
  ]
  ```
- **What to say in Viva:** *"Sir, this pipeline performs an in-database GROUP BY on status and uses `$sum: 1` as an accumulator to count visits per status without pulling all documents into Node.js memory."*

#### 3. Department Appointment Distribution (`$lookup` ➔ `$unwind` ➔ `$group` ➔ `$project` ➔ `$sort`)
- **Exact Lines:** [Lines 47–76](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L47-L76)
- **Original Code Excerpt:**
  ```javascript
  const departmentDistribution = await Appointment.aggregate([
    {
      $lookup: {
        from: 'departments',
        localField: 'departmentId',
        foreignField: '_id',
        as: 'departmentDetails'
      }
    },
    {
      $unwind: {
        path: '$departmentDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$departmentDetails.departmentName',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        department: { $ifNull: ['$_id', 'General / Unassigned'] },
        appointments: '$count'
      }
    },
    { $sort: { appointments: -1 } }
  ]);
  ```
- **Stage-by-Stage Breakdown:**
  1. **`$lookup` (Left Outer Join):** Joins `appointments` with the `departments` collection matching `departmentId` to `_id`. Produces an array field `departmentDetails`.
  2. **`$unwind` (Flatten Array):** Deconstructs the 1-element `departmentDetails` array into a flat sub-object. `preserveNullAndEmptyArrays: true` ensures appointments with unassigned departments are not dropped.
  3. **`$group`:** Groups by department name and calculates the total appointment count using `{ $sum: 1 }`.
  4. **`$project`:** Reshapes the output documents: suppresses default `_id`, renames `$_id` to `department` with `$ifNull` fallback, and renames `$count` to `appointments`.
  5. **`$sort`:** Orders the final breakdown in descending order (`appointments: -1`), displaying the busiest departments first.
- **Output Example:**
  ```json
  [
    { "department": "Cardiology", "appointments": 14 },
    { "department": "Neurology", "appointments": 9 },
    { "department": "Orthopedics", "appointments": 5 }
  ]
  ```
- **What to say in Viva:** *"Sir, this is our most complete aggregation pipeline. It joins appointments with departments via `$lookup`, unwinds the joined array, groups by department name, projects a clean response structure, and sorts by highest booking volume."*

#### 4. Recent Appointments with Multi-Collection Populate
- **Exact Lines:** [Lines 79–84](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L79-L84)
- **Original Code Excerpt:**
  ```javascript
  const recentAppointments = await Appointment.find()
    .populate('patientId', 'name email phone')
    .populate('doctorId', 'name specialization')
    .populate('departmentId', 'departmentName')
    .sort({ createdAt: -1 })
    .limit(6);
  ```
- **What It Does:** Retrieves the 6 most recently created appointments across the hospital, populating patient name, doctor specialization, and department name.
- **What to say in Viva:** *"Sir, this powers the 'Recent Hospital Activity' widget on the admin overview using indexed reverse chronological sorting (`createdAt: -1`)."*

---

### C. Department Queries
**File:** [`src/controllers/departmentController.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/departmentController.js)

#### 1. Active Doctor Count per Department Aggregation
- **Exact Lines:** [Lines 14–44](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/departmentController.js#L14-L44)
- **Original Code Excerpt:**
  ```javascript
  const departments = await Department.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'doctors',
        localField: '_id',
        foreignField: 'departmentId',
        as: 'doctors'
      }
    },
    {
      $project: {
        _id: 1,
        departmentName: 1,
        description: 1,
        icon: 1,
        isActive: 1,
        createdAt: 1,
        doctorCount: {
          $size: {
            $filter: {
              input: '$doctors',
              as: 'doc',
              cond: { $eq: ['$$doc.availability', 'active'] }
            }
          }
        }
      }
    },
    { $sort: { departmentName: 1 } }
  ]);
  ```
- **How It Works:**
  - Filters active departments with `$match`.
  - Performs `$lookup` from `doctors` collection where `departmentId == _id`.
  - In `$project`, instead of returning all doctor documents, it uses the expression `$size` combined with `$filter` to compute the count of doctors whose `availability` is `'active'`.
  - Sorts alphabetically by department name.
- **Why It Is Needed:** Enables the landing page and booking form to show `Cardiology (2 Doctors)` in one single query without loading doctor sub-documents.
- **What to say in Viva:** *"Sir, this query demonstrates advanced projection. Instead of unwinding, it uses `$filter` and `$size` to compute the active doctor count directly on the joined array."*

#### 2. Referential Integrity Guard Before Department Deletion
- **Exact Lines:** [Lines 190–204](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/departmentController.js#L190-L204)
- **Original Code Excerpt:**
  ```javascript
  const doctorCount = await Doctor.countDocuments({ departmentId: department._id });
  if (doctorCount > 0) {
    department.isActive = false;
    await department.save();
    return res.status(200).json({
      success: true,
      message: `Department has ${doctorCount} assigned doctor(s). It has been deactivated to preserve records instead of being deleted.`,
      deactivated: true
    });
  }
  await department.deleteOne();
  ```
- **What It Does:** Before deleting a department, it checks if any doctor documents reference `department._id`. If doctors exist, it denies hard deletion and executes a **soft-deactivation** (`isActive = false`).
- **Why It Is Needed:** MongoDB does not enforce SQL `ON DELETE RESTRICT` foreign keys. This logic prevents orphaned doctor records.
- **What to say in Viva:** *"Sir, because MongoDB does not have cascading foreign key constraints, we implement referential integrity in code: if doctors belong to a department, we soft-deactivate it instead of executing `deleteOne()`."*

---

### D. Patient Queries
**File:** [`src/controllers/patientController.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/patientController.js)

#### 1. Patient Metric Aggregation
- **Exact Lines:** [Lines 16–24](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/patientController.js#L16-L24)
- **Original Code Excerpt:**
  ```javascript
  const statusCounts = await Appointment.aggregate([
    { $match: { patientId: new mongoose.Types.ObjectId(patientId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  ```
- **What It Does:** Groups and counts appointments for the authenticated patient ID.
- **Crucial Mongoose Detail:** In Mongoose `.aggregate()`, `$match` on ObjectIds requires casting the string ID with `new mongoose.Types.ObjectId(patientId)` because aggregation pipelines bypass Mongoose schema auto-casting.
- **What to say in Viva:** *"Sir, in aggregation pipelines, Mongoose does not auto-cast string IDs, so we explicitly wrap the patient ID in `new mongoose.Types.ObjectId()`."*

#### 2. Nearest Upcoming Appointment with `$gte`
- **Exact Lines:** [Lines 41–48](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/patientController.js#L41-L48)
- **Original Code Excerpt:**
  ```javascript
  const nextAppointment = await Appointment.findOne({
    patientId,
    status: 'Booked',
    appointmentDateString: { $gte: todayStr }
  })
    .populate('doctorId', 'name specialization consultationFee')
    .populate('departmentId', 'departmentName')
    .sort({ appointmentDateString: 1, appointmentTime: 1 });
  ```
- **What It Does:** Finds the single nearest future appointment using `$gte` (Greater Than or Equal to today's date string) sorted ascending (`1`) by date and time.
- **What to say in Viva:** *"Sir, this query powers the patient's hero banner by finding the first appointment where date is `$gte` today and sorting ascending."*

---

### E. Doctor Queries
**File:** [`src/controllers/doctorController.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/doctorController.js)

#### 1. Multi-Condition Doctor Catalog Search with `$or` & `$regex`
- **Exact Lines:** [Lines 43–52](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/doctorController.js#L43-L52) (with filter building in Lines 16–41)
- **Original Code Excerpt:**
  ```javascript
  if (search) {
    query.$or = [
      { name: { $regex: new RegExp(search, 'i') } },
      { specialization: { $regex: new RegExp(search, 'i') } }
    ];
  }

  const doctors = await Doctor.find(query)
    .select('-passwordHash')
    .populate('departmentId', 'departmentName icon')
    .sort({ name: 1 })
    .skip(skip)
    .limit(parseInt(limit));
  ```
- **What It Does:** Executes case-insensitive regex search matching either doctor name or specialization using `$or`. Excludes `passwordHash` using `.select('-passwordHash')` for security.
- **What to say in Viva:** *"Sir, `.select('-passwordHash')` ensures sensitive password hashes are never returned across the network."*

#### 2. Doctor Personal Schedule Metrics Aggregation
- **Exact Lines:** [Lines 326–334](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/doctorController.js#L326-L334)
- **Original Code Excerpt:**
  ```javascript
  const statusCounts = await Appointment.aggregate([
    { $match: { doctorId: new require('mongoose').Types.ObjectId(doctorId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  ```
- **What It Does:** Groups appointment counts by status for the specific doctor.

---

### F. Time-Slot Availability Engine
**File:** [`src/services/slotService.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/services/slotService.js)

#### Active Booked Slots Query
- **Exact Lines:** [Lines 97–101](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/services/slotService.js#L97-L101)
- **Original Code Excerpt:**
  ```javascript
  const bookedAppointments = await Appointment.find({
    doctorId: doctor._id,
    appointmentDateString: dateString,
    status: 'Booked'
  }).select('appointmentTime');
  ```
- **Filter Explanation:**
  - `doctorId: doctor._id`: Restricts to the requested physician.
  - `appointmentDateString: dateString`: Restricts to the requested calendar date.
  - `status: 'Booked'`: **CRITICAL:** Only active appointments occupy time slots. Cancelled or Completed visits must NOT block slots!
  - `.select('appointmentTime')`: Projection optimization. Only fetches the `appointmentTime` string (e.g. `"10:30"`), saving bandwidth and RAM.
- **Collision Detection Logic (Lines 103–126):**
  ```javascript
  const bookedTimeSet = new Set(bookedAppointments.map((a) => a.appointmentTime));
  // In the slot generation loop:
  const isBooked = bookedTimeSet.has(slot);
  ```
  The array of booked times is loaded into a JavaScript `Set` for $O(1)$ constant-time lookup. Each generated 30-minute shift slot is compared against the set. If present, its status is marked `'Booked'` and `available: false`.
- **What to say in Viva:** *"Sir, this query fetches only the `appointmentTime` of active 'Booked' visits. We convert them into a JavaScript Set for instant O(1) collision filtering against the doctor's 30-minute shift intervals."*

---

### G. Authentication & User Registration Queries
**Files:** [`src/controllers/authController.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/authController.js) & [`src/middleware/auth.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/middleware/auth.js)

#### 1. Cross-Collection Email Uniqueness Check
- **File:** `src/controllers/authController.js` — [Lines 31–33](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/authController.js#L31-L33)
- **Original Code Excerpt:**
  ```javascript
  const existingPatient = await Patient.findOne({ email: normalizedEmail });
  const existingDoctor = await Doctor.findOne({ email: normalizedEmail });
  const existingAdmin = await Admin.findOne({ email: normalizedEmail });

  if (existingPatient || existingDoctor || existingAdmin) {
    return res.status(409).json({ success: false, message: 'An account with this email address is already registered.' });
  }
  ```
- **What It Does:** Before creating an account, checks all three role collections so an email cannot be registered under multiple roles.

#### 2. User Authentication & Login Verification
- **File:** `src/controllers/authController.js` — [Lines 112–129](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/authController.js#L112-L129)
- **Original Code Excerpt:**
  ```javascript
  if (role === 'doctor') {
    user = await Doctor.findOne({ email: normalizedEmail });
  } else if (role === 'admin') {
    user = await Admin.findOne({ email: normalizedEmail });
  } else if (role === 'patient') {
    user = await Patient.findOne({ email: normalizedEmail });
  } else {
    // Auto-detect role
    user = await Patient.findOne({ email: normalizedEmail });
    detectedRole = 'patient';
    if (!user) { user = await Doctor.findOne({ email: normalizedEmail }); detectedRole = 'doctor'; }
    if (!user) { user = await Admin.findOne({ email: normalizedEmail }); detectedRole = 'admin'; }
  }
  ```
- **What to say in Viva:** *"Sir, our login route supports both explicit role selection and automatic role detection across the three collections, followed by bcrypt hash verification."*

#### 3. Session User Hydration in Middleware
- **File:** `src/middleware/auth.js` — [Lines 43–49](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/middleware/auth.js#L43-L49)
- **Original Code Excerpt:**
  ```javascript
  if (decoded.role === 'patient') {
    currentUser = await Patient.findById(decoded.id).select('-passwordHash');
  } else if (decoded.role === 'doctor') {
    currentUser = await Doctor.findById(decoded.id).select('-passwordHash');
  } else if (decoded.role === 'admin') {
    currentUser = await Admin.findById(decoded.id).select('-passwordHash');
  }
  ```
- **What It Does:** Verifies that the user ID inside the JWT token still exists in MongoDB and attaches `req.user`.

---

### H. Database Index Definitions
**Files:** [`src/models/Appointment.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/models/Appointment.js) & [`src/models/Doctor.js`](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/models/Doctor.js)

#### 1. Compound Partial Unique Index (Double-Booking Guard)
- **File:** `src/models/Appointment.js` — [Lines 82–89](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/models/Appointment.js#L82-L89)
- **Original Code Excerpt:**
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
- **Detailed Mechanics:**
  - **Indexed Fields:** `doctorId` (Ascending), `appointmentDateString` (Ascending), `appointmentTime` (Ascending).
  - **`unique: true`:** Instructs MongoDB's WiredTiger storage engine to enforce uniqueness across this three-field tuple.
  - **`partialFilterExpression: { status: 'Booked' }`:** **THE MOST IMPORTANT CLAUSE.** Only documents matching `status: 'Booked'` are inserted into the index B-Tree.
  - **How it handles Cancellation:** When an appointment's status is updated to `'Cancelled'`, it no longer matches the partial filter. MongoDB immediately removes its index key from the B-Tree, reopening that slot for re-booking while keeping the appointment document intact for medical audits!
  - **What to say in Viva:** *"Sir, this compound partial unique index is our database-level concurrency lock. It guarantees that race conditions between concurrent requests cannot create duplicate bookings. Because it is a partial index filtered on `status: 'Booked'`, soft-cancelling an appointment instantly prunes the entry from the index B-tree, immediately freeing the slot!"*

#### 2. Query Optimization Indexes in Appointment Model
- **File:** `src/models/Appointment.js` — [Lines 92–96](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/models/Appointment.js#L92-L96)
  ```javascript
  appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
  appointmentSchema.index({ doctorId: 1, appointmentDate: -1 });
  appointmentSchema.index({ status: 1 });
  appointmentSchema.index({ departmentId: 1 });
  appointmentSchema.index({ appointmentDateString: 1 });
  ```
- **Purpose:** Optimizes patient history lookup, doctor OPD queues, and date range filtering from an $O(N)$ collection scan into an $O(\log N)$ B-Tree index scan.

#### 3. Full-Text Search Index in Doctor Model
- **File:** `src/models/Doctor.js` — [Lines 89–91](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/models/Doctor.js#L89-L91)
  ```javascript
  doctorSchema.index({ departmentId: 1, availability: 1 });
  doctorSchema.index({ specialization: 1 });
  doctorSchema.index({ name: 'text', specialization: 'text' });
  ```
- **Purpose:** Supports full-text search across doctor names and specializations.

---

## 2. Master Query Reference Table

| # | File Path | Exact Lines | Method / Operator | Purpose | Simple Viva Explanation |
|:---:|:---|:---:|:---|:---|:---|
| **1** | `src/config/db.js` | [13–15](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/config/db.js#L13-L15) | `mongoose.connect()` | Connects Node.js Express server to MongoDB database | *"Initializes the persistent BSON connection pool to MongoDB on port 27017."* |
| **2** | `src/controllers/authController.js` | [31–33](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/authController.js#L31-L33) | `findOne({ email })` | Checks for duplicate emails across Patient, Doctor, Admin | *"Queries all 3 user collections to guarantee email uniqueness hospital-wide."* |
| **3** | `src/controllers/authController.js` | [46–55](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/authController.js#L46-L55) | `Patient.create()` | Inserts a newly registered patient document | *"Performs atomic document insert after hashing the password with bcrypt."* |
| **4** | `src/controllers/authController.js` | [112–129](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/authController.js#L112-L129) | `findOne({ email })` | Locates user credentials during portal login | *"Searches the targeted role collection to retrieve the stored password hash."* |
| **5** | `src/middleware/auth.js` | [43–49](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/middleware/auth.js#L43-L49) | `findById().select('-passwordHash')` | Validates JWT user and excludes password hash | *"Hydrates the active user session while stripping sensitive credentials."* |
| **6** | `src/services/slotService.js` | [97–101](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/services/slotService.js#L97-L101) | `find().select('appointmentTime')` | Retrieves occupied slots for a doctor on a specific date | *"Finds active booked times so the slot generator can disable occupied buttons."* |
| **7** | `src/controllers/appointmentController.js` | [112–117](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L112-L117) | `findOne()` (Slot Conflict) | Application pre-check for existing doctor booking | *"Verifies the doctor has no active booking at that date/time before proceeding."* |
| **8** | `src/controllers/appointmentController.js` | [127–132](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L127-L132) | `findOne()` (Patient Conflict) | Prevents patient from booking two concurrent visits | *"Ensures the patient is not double-booked across different departments at once."* |
| **9** | `src/controllers/appointmentController.js` | [146–155](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L146-L155) | `Appointment.create()` | Inserts the new confirmed appointment document | *"Executes the atomic insert linking patient, doctor, department, and time slot."* |
| **10** | `src/controllers/appointmentController.js` | [157–160](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L157-L160) | `.populate()` | Resolves BSON ObjectId references into document details | *"Hydrates patient, doctor, and department ObjectIds for the confirmation modal."* |
| **11** | `src/controllers/appointmentController.js` | [207–215](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L207-L215) | `countDocuments()`, `find().skip().limit()` | Role-filtered appointment list with pagination | *"Executes paginated queries scoped strictly to the authenticated user's ID."* |
| **12** | `src/controllers/appointmentController.js` | [346–352](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L346-L352) | `findOne()` with `$ne` | Conflict detection during appointment rescheduling | *"Uses `$ne` to check if another appointment already occupies the target slot."* |
| **13** | `src/controllers/appointmentController.js` | [437–442](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L437-L442) | `appointment.save()` | Soft cancellation with audit metadata | *"Updates status to 'Cancelled', preserving history and freeing the slot index."* |
| **14** | `src/controllers/appointmentController.js` | [485–490](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/appointmentController.js#L485-L490) | `appointment.save()` | Doctor marks visit Completed with notes and Rx | *"Stores doctor consultation notes and digital prescription on the appointment."* |
| **15** | `src/controllers/doctorController.js` | [43–52](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/doctorController.js#L43-L52) | `find()` with `$or`, `$regex` | Doctor catalog filtering and search | *"Executes case-insensitive search across doctor names and specialties."* |
| **16** | `src/controllers/doctorController.js` | [326–334](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/doctorController.js#L326-L334) | `aggregate()`: `$match`, `$group` | Calculates doctor's appointment status counts | *"Groups appointments by status for the doctor's OPD metrics cards."* |
| **17** | `src/controllers/departmentController.js` | [14–44](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/departmentController.js#L14-L44) | `aggregate()`: `$match`, `$lookup`, `$project`, `$size`, `$filter` | Computes active doctor counts per department | *"Joins doctors and uses `$size` + `$filter` to return active counts per specialty."* |
| **18** | `src/controllers/departmentController.js` | [190–204](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/departmentController.js#L190-L204) | `Doctor.countDocuments()`, `deleteOne()` | Referential integrity check before department deletion | *"Soft-deactivates if doctors exist; hard-deletes only if department is empty."* |
| **19** | `src/controllers/patientController.js` | [16–24](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/patientController.js#L16-L24) | `aggregate()`: `$match`, `$group` | Calculates patient dashboard status metrics | *"Groups appointments for the logged-in patient using explicit ObjectId casting."* |
| **20** | `src/controllers/patientController.js` | [41–48](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/patientController.js#L41-L48) | `findOne()` with `$gte` & `.sort()` | Finds patient's nearest upcoming appointment | *"Fetches the single next upcoming consultation starting from today's date."* |
| **21** | `src/controllers/adminController.js` | [15–21](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L15-L21) | `Promise.all(countDocuments())` | Hospital-wide summary counter | *"Runs 5 count operations concurrently across all collections."* |
| **22** | `src/controllers/adminController.js` | [24–31](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L24-L31) | `aggregate()`: `$group`, `$sum` | Hospital appointment status distribution | *"Aggregates total booked, completed, and cancelled visits across the hospital."* |
| **23** | `src/controllers/adminController.js` | [47–76](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/controllers/adminController.js#L47-L76) | `aggregate()`: `$lookup`, `$unwind`, `$group`, `$project`, `$sort` | Department booking distribution pipeline | *"Performs multi-stage aggregation to rank departments by patient booking load."* |
| **24** | `src/models/Appointment.js` | [82–89](file:///c:/Users/RUTHVIK%20REDDY.T/Desktop/Hospital-AppointmentManagementSystem/src/models/Appointment.js#L82-L89) | Compound Partial Unique Index | Database-level double-booking prevention | *"Storage-level B-Tree index locking doctor+date+time for active 'Booked' status."* |

---

## 3. Crucial Review Distinction: Validation vs. Index vs. Transactions

During your review, professors frequently test whether students understand the difference between application logic, index constraints, and database transactions:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Application-Level Validation (JavaScript in Express Controller)      │
│    • appointmentController.js Lines 112–124                            │
│    • Calls: Appointment.findOne({ doctorId, date, time, status:'Booked' })│
│    • Catches 99% of normal booking attempts.                           │
│    • Limitation: Vulnerable to race conditions if two requests hit at   │
│      the exact same millisecond.                                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Database-Level Unique Index Constraint (WiredTiger Storage Engine)  │
│    • Appointment.js Lines 82–89                                        │
│    • Index: { doctorId: 1, date: 1, time: 1 } WHERE status == 'Booked' │
│    • If two requests pass Step 1 concurrently, WiredTiger atomically   │
│      inserts the first and REJECTS the second with error code 11000.   │
│    • Caught by appointmentController.js Line 168 (returns HTTP 409).   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Are Multi-Document ACID Transactions Used in this Workflow?         │
│    • ANSWER TO PROFESSOR: NO.                                         │
│    • Why? In MongoDB, single-document writes (like Appointment.create) │
│      are ALWAYS atomic by default. Because our booking workflow only   │
│      modifies ONE document in ONE collection, a multi-document         │
│      distributed transaction (session.startTransaction) is not needed!  │
└────────────────────────────────────────────────────────────────────────┘
```
