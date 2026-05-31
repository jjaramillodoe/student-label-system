# Student Label System Documentation Brief

Use this Markdown file as source material for creating user guides, SOPs, training handouts, or chatbot-generated documentation for Data Leads and Data Members.

## Copy-Ready Prompt For Another Chatbot

```text
Create clear user documentation for the Student Label System using the information below.

Audience:
- Data Leads
- Data Members

Tone:
- Friendly, practical, step-by-step
- Written for school operations users, not developers
- Explain what each feature does, when to use it, and any cautions

Output requested:
- A user guide with sections for Data Leads and Data Members
- Quick-start checklist
- Daily workflow guide
- Bulk upload guide
- Cabinet and drawer guide
- Printing and scanning guide
- Troubleshooting section
- FAQ
- Short training script for a live walkthrough

Important:
- Data Leads have broader school-level management tools.
- Data Members focus on adding, editing, finding, and printing student records for their assigned school.
- Do not include developer setup instructions unless creating an admin/deployment guide.

Use the documentation brief below as the source of truth.
```

## System Overview

The Student Label System helps school staff manage student records, file locations, cabinet/drawer assignments, labels, barcodes, QR codes, and data quality checks.

The app is designed around physical file management. Each student record can be assigned to a cabinet and drawer. Labels can be printed with barcode and QR code information so staff can quickly identify the student and locate the file.

## Role Overview

### Data Lead

Data Leads manage student data for their assigned school. They can use the operational tools needed to keep data clean, cabinets accurate, and records organized.

Typical Data Lead responsibilities:

- Bulk upload student records from CSV files.
- Review and fix upload preview issues before saving.
- Manage cabinet and drawer assignments.
- Move students between drawers in bulk.
- Review duplicate records.
- Review unassigned or invalid cabinet/drawer assignments.
- Use cabinet health tools to find full, near-full, empty, or over-capacity drawers.
- Run activity and audit reports.
- Use data cleanup tools for invalid emails, missing dates, old inactive records, and archived-but-assigned records.

### Data Member

Data Members manage day-to-day student records for their assigned school.

Typical Data Member responsibilities:

- Add individual student records.
- Search for students by name, email, or student ID.
- Edit student details when needed.
- Print labels.
- Scan barcodes or QR codes for lookup.
- Use filters and saved searches.
- Archive inactive records when appropriate, if enabled for their workflow.

## Role Permission Summary

| Feature Area | Data Lead | Data Member |
| --- | --- | --- |
| View assigned school students | Yes | Yes |
| Add individual students | Yes | Yes |
| Edit student records | Yes | Yes |
| Print labels | Yes | Yes |
| Barcode/QR lookup | Yes | Yes |
| Bulk CSV upload | Yes | Usually yes, depending on local policy |
| Cabinet management | Yes | Limited or no |
| Cabinet health dashboard | Yes | Usually no |
| Duplicate detector | Yes | Usually no |
| Unassigned queue | Yes | Usually no |
| Bulk move students | Yes | Usually no |
| Data cleanup center | Yes | Usually no |
| Activity reports | Yes | Usually no |
| User management | No, Admin only | No |
| School configuration | No, Admin only | No |

## Main Navigation Areas

### Dashboard

The Dashboard is the main workspace for student records.

Users can:

- View student records.
- Search and filter students.
- Add a new student.
- Select students for printing or bulk actions.
- Open student details.
- Print labels.
- Show or hide QR codes.
- Access saved searches.

### Bulk Upload

Bulk Upload is used to import many students from a CSV file.

Location:

- `/admin/students/bulk-upload`

Supported file type:

- CSV only.

Required CSV columns:

```csv
firstName,lastName,dob,fiscalYear,status,startDate,email,studentId
```

Notes:

- `studentId` can be blank. The system can generate one.
- Cabinet and drawer are selected on the upload page, not inside the CSV.
- Dates can be entered as `YYYY-MM-DD` or common short formats like `1/12/06`; the app normalizes dates during import.
- Names are trimmed and converted to Proper Case.
- Emails are trimmed and converted to lowercase.

### Cabinets

Cabinets and drawers represent physical storage.

Each cabinet has:

- Name
- Optional identifier
- School
- Drawers
- Drawer capacities
- Current counts

Example cabinet pattern:

- Cabinet name: `Main Cabinet`
- Identifier: `A-D`
- Drawers: `Drawer A`, `Drawer B`, `Drawer C`, `Drawer D`

## Bulk Upload Workflow

### Recommended Steps

1. Open Bulk Upload.
2. Download the CSV template or sample CSV.
3. Fill in student information.
4. Select the cabinet and starting drawer.
5. Keep smart allocation enabled if the upload may exceed current drawer capacity.
6. Upload the CSV.
7. Review the preview.
8. Fix rows with issues or use the Ready filter.
9. Click `Upload Ready Students`.
10. Continue fixing any remaining rows if needed.

### Upload Preview

The preview checks each row before saving.

The system can flag:

- Missing first name.
- Missing last name.
- Invalid DOB.
- Invalid start date.
- Unknown fiscal year.
- Unknown status.
- Invalid email.
- Missing cabinet.
- Missing drawer.
- Duplicate student ID already exists.
- Duplicate student ID in the file.
- Duplicate email already exists.
- Duplicate email in the file.
- Same name and DOB already exists.
- Same name and DOB repeated in the file.

### Preview Filters

The preview includes smart filters:

- `All`: Shows every uploaded row.
- `Ready`: Shows rows that can be uploaded now.
- `Needs Fixing`: Shows rows with validation issues.

This allows users to upload clean rows even if other rows still need correction.

### Upload Ready Students

The upload button uploads only rows with no validation issues.

After upload:

- Successfully uploaded rows are removed from the preview.
- Rows with issues remain available for correction.
- The user can fix remaining rows and upload again.

## Smart Cabinet Allocation

Smart allocation helps Data Leads handle very large uploads, such as 4,000+ students.

When enabled:

- The user selects a starting cabinet and drawer.
- The system fills available space starting from that drawer.
- It continues into the next available drawers in matching cabinets.
- If there is not enough capacity, the system creates the next cabinet range based on the selected cabinet pattern.

Example:

Existing cabinet:

- `Main Cabinet A-D`
- Drawers: `Drawer A`, `Drawer B`, `Drawer C`, `Drawer D`

If more storage is needed, the system can create:

- `Main Cabinet E-H`
- Drawers: `Drawer E`, `Drawer F`, `Drawer G`, `Drawer H`

Then, if needed:

- `Main Cabinet I-L`

The new cabinets copy:

- Same cabinet name.
- Same number of drawers.
- Same drawer capacities.
- Same school.

### When To Use Smart Allocation

Use smart allocation when:

- Uploading a large July or beginning-of-year file.
- You are not sure current cabinets have enough room.
- You want the system to continue the cabinet pattern automatically.

Turn it off when:

- You only want to upload into the selected drawer.
- You do not want the system to create new cabinets automatically.

## Student Search And Filters

Users can search by:

- First name.
- Last name.
- Email.
- Student ID.
- Scanned barcode.
- Scanned QR code text.

Advanced filters may include:

- Fiscal year.
- Status.
- Start date.
- End date.
- Cabinet.
- Drawer.
- Email.

Saved searches can be used for filters that staff run often.

## Student Records

Student records include:

- First name.
- Last name.
- DOB.
- Fiscal year.
- Status.
- Start date.
- Email.
- Student ID.
- Cabinet.
- Drawer.
- School.

Student IDs are generated using:

- Birth year.
- First and last initials.
- A padded counter.

Example:

```text
2006-AR-9000001
```

## Labels, Barcodes, And QR Codes

Labels can include:

- Student name.
- Student ID.
- Barcode.
- QR code.
- Cabinet/drawer location.

QR codes include readable location details.

Example QR payload:

```text
Student ID: 2019-JS-0000001
Name: Jane Smith
DOB: 2009-04-12
Cabinet: Main Cabinet
Drawer: Drawer C
School: School 8
```

The app can extract the student ID from QR text so users can scan a QR code into search and find the student.

## Printing Workflow

1. Search or filter for students.
2. Select one or more students.
3. Choose a label layout.
4. Print selected students or print all filtered students.
5. Use reprint tools when needed.

Supported label workflows include:

- Single label.
- Double label.
- Avery labels.
- Brother DK label formats.
- Custom label sizes.

## Data Lead Tools

### Cabinet Health Dashboard

Purpose:

- Find storage problems in one place.

Shows:

- Full drawers.
- Near-full drawers.
- Empty drawers.
- Over-capacity cabinets.
- Bad student assignments.

Use this before large imports to confirm there is enough room.

### Duplicate Student Detector

Purpose:

- Find potential duplicate student records.

Flags:

- Same name and DOB.
- Same email.
- Exact duplicate student IDs.
- Similar student IDs.

### Unassigned Student Queue

Purpose:

- Find students with missing or bad storage assignments.

Flags:

- Missing cabinet.
- Missing drawer.
- Invalid cabinet/drawer references.
- Students assigned to full or over-capacity drawers.

### Bulk Move Tool

Purpose:

- Move multiple students from one cabinet/drawer to another.

Includes:

- Student selection.
- Source filters.
- Target cabinet/drawer selection.
- Capacity validation.
- Count updates for source and target drawers.

### Data Cleanup Center

Purpose:

- Find and fix common data problems.

Finds:

- Invalid emails.
- Missing or invalid dates.
- Old inactive students.
- Archived students still assigned to cabinet/drawer space.

Bulk fixes may include:

- Clear invalid emails.
- Archive old inactive records.
- Unassign archived records.

### Activity Report

Purpose:

- Review who performed key actions.

Shows:

- Added records.
- Edited records.
- Printed labels.
- Archived records.
- Deleted records.

Time windows:

- Last 7 days.
- Last 30 days.
- Last 90 days.

## Profile And Security

Users can manage their own profile security.

Features:

- Change password.
- Enable authenticator-app MFA.
- Scan MFA QR code during setup.
- Enter 6-digit MFA code at login.
- Disable MFA from profile with current password.

If a user is locked out, an Admin can disable MFA or reset the password.

## Common Troubleshooting

### Upload Button Is Disabled

Possible reasons:

- No cabinet selected.
- No drawer selected.
- No rows are ready.
- Smart allocation is off and the selected drawer does not have enough space.

What to do:

- Select a cabinet and drawer.
- Use the `Ready` filter to see uploadable rows.
- Fix rows under `Needs Fixing`.
- Turn on smart allocation if more cabinet space is needed.

### Rows Show Duplicate Email Or Same Name And DOB

This means the row may already exist in the database.

What to do:

- Confirm whether the student already exists.
- If it is the same student, do not upload a duplicate.
- If it is a different student, update the email or identifying information if appropriate.

### Dates Look Wrong Or Blank

Preferred date format:

```text
YYYY-MM-DD
```

The importer also attempts to normalize common dates like:

```text
1/12/06
9/4/25
```

### Unknown Fiscal Year

The row has a fiscal year that is not in the approved list.

What to do:

- Use one of the available fiscal year dropdown values in the preview.
- Ask an Admin if a new fiscal year needs to be added to the app.

### Not Enough Drawer Capacity

This happens when smart allocation is off and the selected drawer does not have enough room.

What to do:

- Turn on smart allocation.
- Select a drawer with more room.
- Ask a Data Lead/Admin to create more cabinets.

## Suggested Training Agenda

### 30-Minute Data Member Training

1. Login and profile overview.
2. Search for a student.
3. Add a student.
4. Edit a student.
5. Print a label.
6. Scan barcode/QR code.
7. Use filters and saved searches.
8. Review common mistakes.

### 45-Minute Data Lead Training

1. Review Data Member workflow.
2. Bulk upload CSV walkthrough.
3. Fix preview issues.
4. Upload ready rows.
5. Smart cabinet allocation example.
6. Cabinet health dashboard.
7. Duplicate detector.
8. Unassigned queue.
9. Bulk move tool.
10. Data cleanup center.
11. Activity report.

## Quick Reference

### Before A Large Upload

- Confirm school assignment is correct.
- Review cabinet health.
- Confirm cabinet pattern exists.
- Use a clean CSV.
- Keep smart allocation enabled.
- Upload ready rows first.
- Fix remaining rows after the first pass.

### CSV Best Practices

- Keep headers exactly as expected.
- Use one student per row.
- Use valid fiscal year values.
- Use valid status values.
- Include email when available.
- Leave `studentId` blank if the system should generate it.
- Avoid duplicate emails unless intentional.

### Valid Status Examples

- Active
- Inactive
- Graduated
- Withdrawn
- Pending
- Transferred
- Other

## Documentation Notes For Writers

When turning this into formal documentation:

- Use screenshots of the Dashboard, Bulk Upload, Preview filters, and Cabinet Health pages.
- Include an example CSV row.
- Include an example of fixing a row in the preview.
- Include a warning that duplicates should be reviewed carefully before uploading.
- Create separate guides for Data Leads and Data Members if the audience needs simpler handouts.
- For July uploads, emphasize smart allocation and cabinet health checks.
