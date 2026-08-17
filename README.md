# Student Label System

A comprehensive Next.js application for managing student records, cabinet/drawer assignments, and label generation for the Department of Education (DOE).

## Features

### 📈 Analytics & Reporting
- **Dashboard statistics**:
  - Total students (with active/archived breakdown)
  - Storage utilization with visual progress bars
  - Recent print activity (last 30 days)
  - Recent audit activity (last 7 days)
  - New students this month
- **Print reports & analytics** (`/reports`):
  - Visual charts (Line, Bar, Pie charts)
  - Print trends over time
  - Most printed students
  - User activity reports
  - Grouping by day, week, month, user, or student
  - Export to PDF and CSV
- **Label stock** (`/admin/label-stock`):
  - Track sheets on hand and cost per sheet
- **Activity report** (`/admin/activity-report`):
  - 7/30/90 day activity windows
  - Tracks who added, edited, printed, archived, or deleted records
  - User-level activity totals and student touch counts
  - Recent activity feed
  - CSV export

### 🎨 User Interface Enhancements
- **Modern UI with shadcn/ui**:
  - Consistent design system
  - Accessible components
  - Dark mode support
  - Responsive design
- **Enhanced components**:
  - Student table with improved layout and actions
  - Card-based layouts
  - Dropdown menus for actions
  - Tooltips for additional information
  - Loading states and skeletons
  - Empty states with helpful messages
- **Dark mode** - Toggle between light and dark themes
- **Component reusability** - Extracted reusable components for better maintainability

### 🔐 Authentication & User Management
- **Role-based access control** with three user roles:
  - **Admin**: Full system access
  - **Data Lead**: Cabinet management and student oversight
  - **Data Member**: Student management within assigned school
- **Secure login** with DOE email addresses
- **User management dashboard** with last login tracking
- **Automatic lastLogin updates** on every successful authentication
- **Self-service profile security**:
  - Users can change their own password from `/profile`
  - Authenticator-app MFA setup with QR code enrollment
  - MFA disablement from profile with current password confirmation
- **Admin security recovery panel**:
  - Reset user passwords
  - Force password change on next login
  - Clear forced password change
  - Disable MFA for locked-out users so they can re-enroll
- **Role permission preview**:
  - Shows what Admin, Data Lead, and Data Member can do before assigning a role
  - Displays role scope such as all schools vs assigned school
- **Database-backed role and school assignment**:
  - User role/school edits are saved to MongoDB
  - Login sessions use database values instead of hardcoded assignments
- **School configuration** (`/admin/schools`):
  - Manage allowed schools/programs from the UI
  - Active/inactive school options for dropdowns
  - Default fallback options for District 79 and School 1-8

### 👥 Student Management
- **Individual student creation** with auto-generated Student IDs
- **Bulk student upload** via CSV files
  - Preview rows before saving
  - Detect invalid DOBs/start dates, missing fields, unknown fiscal year/status
  - Detect duplicate student IDs, emails, and same name+DOB
  - Edit preview rows inline before upload
  - Validate selected cabinet/drawer capacity before saving
  - Download header-only CSV template
  - Download sample CSV files for testing
- **Student editing and archiving** capabilities
- **Advanced search and filtering**:
  - Search by name, student ID, or email
  - Filter by fiscal year, status, start/end dates
  - Filter by cabinet and drawer location
  - Email search
  - **Saved searches** - Save frequently used filter combinations
- **Sortable table columns** - Click any column header to sort (Student ID, Name, DOB, Fiscal Year, Status, Location, Start Date)
- **Enhanced student details modal** with:
  - Organized card-based layout
  - QR code display
  - Barcode visualization
  - Complete student information
- **Bulk operations** (archive, status updates, fiscal year changes, delete)
- **Barcode scanner integration** - Scan barcodes to quickly find students
- **QR scanner integration**:
  - QR codes include Student ID, name, DOB, cabinet, drawer, and school
  - App search extracts Student ID from the full QR payload
- **Form auto-clear** - Form automatically clears after successful submission for quick entry
- **Duplicate student detector** (`/admin/duplicates`):
  - Flags same name + DOB
  - Flags duplicate emails
  - Flags exact and similar student IDs
- **Unassigned student queue** (`/admin/unassigned`):
  - Finds students missing cabinet/drawer
  - Finds invalid cabinet/drawer assignments
  - Flags students assigned to full or over-capacity drawers
- **Bulk move tool** (`/admin/bulk-move`):
  - Move selected students from one cabinet/drawer to another
  - Capacity validation before updates
  - Updates source and target drawer counts

### 🗄️ Cabinet & Drawer Management
- **Multi-cabinet support** with unique identifiers
- **Drawer organization** within cabinets
- **Capacity tracking** with automatic count updates
- **Cabinet assignment** during student creation
- **Archive cabinet** for inactive students
- **School filtering** - Filter cabinets by school for easy navigation
- **Smart Fill feature** - One-click button to auto-fill cabinet form with intelligent suggestions:
  - Suggests available cabinet names
  - Auto-generates identifiers when needed
  - Pre-fills school based on user or most common
  - Creates 5 drawers with default names and capacity
- **Smart cabinet seeding** - Automated cabinet creation for configured schools:
  - Creates cabinets when storage utilization is high
  - Pre-fills cabinets with test students
  - Configurable drawers, capacity, and student count
- **Visual capacity indicators** - Color-coded progress bars (red for full, yellow for near full)
- **Enhanced cabinet management page**:
  - Summary cards for cabinets, stored files, available space, and attention items
  - Capacity status filtering
  - Sorting by name, school, stored files, capacity, and usage
  - Over-capacity warnings
- **Cabinet health dashboard** (`/admin/cabinet-health`):
  - Full and near-full drawers
  - Empty drawers
  - Over-capacity cabinets
  - Bad student assignments in one place

### 📊 Data Integrity & Maintenance
- **Audit tools** for identifying data inconsistencies
- **Enhanced audit log page** (`/audit`):
  - Dedicated full-page interface
  - Advanced filtering (action type, date range, user, student)
  - Date presets for today, last 7 days, last 30 days, and last 90 days
  - Timeline summary cards
  - User information tracking (who performed actions)
  - Export to CSV
  - Role-based filtering
- **Sync tools** for cabinet/drawer count corrections
- **Data migration scripts** for system updates
- **Validation** for ObjectId formats and data integrity
- **Test data seeding**:
  - Generate test students with realistic data
  - Configurable count (1-500 students)
  - Auto-assignment to existing cabinets
  - Smart ID generation (no duplicates)
- **Data cleanup center** (`/admin/data-cleanup`):
  - Finds invalid emails
  - Finds missing or invalid DOB/start dates
  - Finds old inactive students that should be archived
  - Finds archived students still assigned to cabinet/drawer space
  - Bulk fixes for clearing invalid emails, archiving old inactive records, and unassigning archived students

### 🏷️ Label Generation & Printing
- **Barcode generation** for student IDs
- **QR code generation** - QR codes for quick student lookup and file location:
  - Student ID
  - Name
  - DOB
  - Cabinet
  - Drawer
  - School
- **Multiple label templates**:
  - Standard Avery labels
  - Brother DK label formats (DK-1201, DK-11208, DK-2205, DK-22208)
  - Custom label dimensions
- **Print-friendly layouts** with customizable options
- **Multiple print modes**:
  - Single student printing
  - Batch printing (selected students)
  - Print all filtered students
  - Custom label dimensions
- **Print preview** - Preview labels before printing
- **Reprint functionality**:
  - Reprint last print job
  - Select from print history
  - One-click reprint for selected students
- **Print history tracking** - Track all print jobs with:
  - User information
  - Timestamp
  - Student list
  - Label count
  - Layout used
- **Label print queue/history** (`/admin/print-queue`):
  - Search print history by user, school, student, or ID
  - Filter by status and layout
  - View failed-job status when logged
  - Reprint previous jobs
  - Estimate label stock usage by template
  - Export print history to CSV
- **Brother Professional Label Printer support**:
  - Optimized for Brother QL-800 printers
  - Continuous feed support
  - 300 DPI optimization
  - Print setup instructions
- **Label stock tracking** - Track inventory per template with low stock alerts

## Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB database
- DOE email credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd student-label-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)

## User Roles & Permissions

### Admin
- Full system access
- User management
- Password/MFA recovery for users
- Role permission preview when assigning users
- School/program configuration
- Cabinet/drawer management
- All student operations
- System audit tools
- Data cleanup and migration tools

### Data Lead
- Cabinet/drawer management
- Student oversight within school
- Bulk operations
- Cabinet health, duplicates, unassigned queue, bulk move, activity reports, print queue, and data cleanup tools
- Cannot manage users or security recovery

### Data Member
- Student management within assigned school
- Individual student operations
- View-only access to cabinets

## Data Management Scripts

### Fix Invalid Students
Fixes students with missing or invalid cabinet/drawer assignments by assigning them to a default cabinet.

```bash
npx tsx scripts/fix-invalid-students.ts
```

### Fix Negative Counts
Corrects negative `currentCount` values in cabinets and drawers by setting them to zero.

```bash
npx tsx scripts/fix-negative-counts.ts
```

### Add User
Adds a new user to the system with proper role assignment.

```bash
npm run add-user
```

### Reset Password
Resets a user's password from the command line.

```bash
npm run reset-password -- user@schools.nyc.gov
```

### Add District Admins
Creates or updates configured District 79 admin accounts.

```bash
npm run add-district-admins
```

**Note**: These scripts require Node.js v22+ compatibility. If you encounter ESM module errors, use `npx tsx` instead of `node` to run TypeScript files directly.

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication
- `POST /api/auth/clear` - Clear authentication data

### Students
- `GET /api/students` - Fetch students (filtered by role/school)
- `POST /api/students` - Create new student
- `PUT /api/students/[id]` - Update student
- `DELETE /api/students/[id]` - Archive student

### Cabinets
- `GET /api/cabinets` - Fetch cabinets
- `POST /api/cabinets` - Create cabinet
- `PUT /api/cabinets/[id]` - Update cabinet
- `DELETE /api/cabinets/[id]` - Delete cabinet
- `POST /api/cabinets/sync` - Sync cabinet counts
- `POST /api/cabinets/audit` - Audit cabinet assignments

### Users
- `GET /api/users` - Fetch users (Admin only)
- `POST /api/users` - Create user (Admin only)
- `PUT /api/users/[id]` - Update user (Admin only)
- `DELETE /api/users/[id]` - Delete user (Admin only)
- `POST /api/users/migrate` - Migrate user data
- `POST /api/admin/users/[id]/security` - Reset password, force password change, clear force change, or disable MFA

### Profile Security
- `PUT /api/profile/password` - Change current user's password
- `POST /api/profile/mfa` - Start MFA enrollment
- `PUT /api/profile/mfa` - Verify and enable MFA
- `DELETE /api/profile/mfa` - Disable MFA

### Audit Logs
- `GET /api/audit-logs` - Fetch audit logs (filtered by role/school)
- `POST /api/audit-logs` - Create audit log entry

### Print History & Reports
- `GET /api/print-history` - Fetch print history (filtered by date, user, student)
- `POST /api/print-history` - Record print event
- `GET /api/print-reports` - Get aggregated print statistics and reports

### Dashboard Statistics
- `GET /api/dashboard-stats` - Get dashboard statistics (students, storage, prints, activity)

### Saved Searches
- `GET /api/saved-searches` - Fetch user's saved search filters
- `POST /api/saved-searches` - Save a new search filter
- `DELETE /api/saved-searches/[id]` - Delete a saved search

### Label Stock
- `GET /api/label-stock` - Fetch label stock inventory
- `POST /api/label-stock` - Create label stock entry
- `PUT /api/label-stock/[id]` - Update label stock entry
- `DELETE /api/label-stock/[id]` - Delete label stock entry

### Admin Tools
- `GET /api/admin/cabinet-health` - Cabinet health summary and issue lists
- `GET /api/admin/duplicate-students` - Duplicate student detection
- `GET /api/admin/unassigned-students` - Students with assignment issues
- `POST /api/admin/bulk-move` - Move selected students to another drawer
- `GET /api/admin/data-cleanup` - Data cleanup scan
- `POST /api/admin/data-cleanup` - Run cleanup actions
- `GET /api/admin/schools` - Fetch configured school/program options
- `POST /api/admin/schools` - Create school/program option
- `PUT /api/admin/schools` - Update school/program option
- `DELETE /api/admin/schools` - Delete school/program option

### Test Data Seeding
- `POST /api/seed-test-data` - Generate test student data (Admin only)
- `POST /api/seed-cabinets` - Smart cabinet seeding for configured schools (Admin only)

## Data Structure

### Student Schema
```typescript
{
  _id: ObjectId,
  studentId: string,        // Auto-generated: YYYY-INITIALS-0000001
  firstName: string,
  lastName: string,
  dob: string,             // YYYY-MM-DD format
  email?: string,
  fiscalYear: string,
  status: string,
  startDate: string,
  endDate?: string,
  cabinet: ObjectId,       // Reference to cabinet
  drawer: ObjectId,        // Reference to drawer
  school: string,
  archived: boolean,
  createdAt: string,
  updatedAt: string
}
```

### Cabinet Schema
```typescript
{
  _id: ObjectId,
  name: string,
  identifier?: string,     // Optional unique identifier
  drawers: [{
    _id: ObjectId,
    name: string,
    capacity: number,
    currentCount: number
  }],
  totalCapacity: number,
  currentCount: number,
  createdAt: string,
  updatedAt: string
}
```

### User Schema
```typescript
{
  _id: ObjectId,
  name: string,
  email: string,
  role: 'Admin' | 'Data Lead' | 'Data Member',
  school: string,
  password: string,        // Hashed with bcrypt
  lastLogin?: string,      // Updated on each login
  mfaEnabled?: boolean,
  mfaBypass?: boolean,   // Admin testing/QA: skip MFA challenge at login
  mfaSecret?: string,      // Excluded from API responses
  mfaPendingSecret?: string,
  forcePasswordChange?: boolean,
  createdAt: string,
  updatedAt: string
}
```

### School Configuration Schema
```typescript
{
  _id: ObjectId,
  name: string,
  type: 'District' | 'School' | 'Program' | 'Other',
  active: boolean,
  createdAt: string,
  updatedAt: string
}
```

### QR Code Payload
Student QR codes scan as readable text:

```text
Student ID: 2019-JS-0000001
Name: Jane Smith
DOB: 2009-04-12
Cabinet: Main Cabinet
Drawer: Drawer C
School: School 8
```

The app scanner/search extracts `Student ID` from the full QR payload for lookup.

## Pages & Routes

### Main Pages
- `/` - Dashboard with student management and statistics
- `/audit` - Enhanced audit log page with filtering and export
- `/reports` - Print reports and analytics with charts
- `/admin/users` - User management (Admin only)
- `/admin/users/migrate` - User migration tool
- `/admin/cabinets` - Cabinet and drawer management
- `/admin/cabinet-health` - Cabinet health dashboard
- `/admin/duplicates` - Duplicate student detector
- `/admin/unassigned` - Unassigned student queue
- `/admin/bulk-move` - Bulk student move tool
- `/admin/activity-report` - User activity report
- `/admin/print-queue` - Label print queue/history
- `/admin/data-cleanup` - Data cleanup center
- `/admin/schools` - School/program configuration
- `/admin/students` - Student management page
- `/admin/students/bulk-upload` - Bulk student upload via CSV
- `/admin/label-stock` - Label stock inventory management
- `/admin/migrate/drawers` - Drawer migration tool
- `/profile` - Profile, password change, and MFA setup
- `/auth/signin` - Sign in
- `/auth/error` - Authentication error page

## Key Components

### Reusable Components
- `DashboardHeader` - Main dashboard header with actions
- `StudentFilters` - Advanced filtering and search
- `StudentActionsBar` - Bulk actions and print controls
- `StudentTable` - Enhanced sortable student table
- `PrintView` - Print preview and label rendering
- `EditStudentModal` - Student editing modal
- `DeleteConfirmationModal` - Delete confirmation dialog
- `BulkUpdateModal` - Bulk update operations
- `DashboardStats` - Statistics cards
- `PrintHistory` - Print history viewer
- `ReprintButton` - Reprint functionality
- `SavedSearches` - Saved search filters
- `BarcodeScanner` - Barcode scanning integration
- `QRCode` - QR rendering for student labels and MFA setup
- `SeedTestData` - Test data generation
- `SeedCabinets` - Smart cabinet seeding
- `PrinterConfig` - Printer setup instructions

## Bulk Upload Templates

Sample files are available in `public/` and from the bulk upload page:

- `public/student_bulk_upload_template.csv` - Header-only CSV template
- `public/student_bulk_upload_sample.csv` - Valid test CSV with sample student rows

Bulk upload columns:

```csv
firstName,lastName,dob,fiscalYear,status,startDate,email,studentId
```

Cabinet and drawer are selected in the upload UI for the entire file, so they do not need to be included in the CSV.

## Troubleshooting

### Common Issues

1. **"Failed to fetch cabinets" error**
   - Check authentication status
   - Ensure user has proper role permissions
   - Verify MongoDB connection

2. **Negative cabinet counts**
   - Run the fix-negative-counts script
   - Use the "Sync Counts" button in the cabinets page
   - Check for data integrity issues

3. **Invalid ObjectId errors**
   - Run the fix-invalid-students script
   - Use the "Audit Assignments" button in the cabinets page
   - Verify cabinet/drawer assignments

4. **Script execution errors**
   - Use `npx tsx` instead of `node` for TypeScript files
   - Ensure Node.js v22+ compatibility

5. **405 Method Not Allowed errors**
   - Ensure API routes are in `route.ts` files within folders
   - Check that route handlers are properly exported

6. **Hydration mismatch errors**
   - This is normal for client-side dark mode initialization
   - The app handles this automatically with `suppressHydrationWarning`

7. **Empty response or JSON parsing errors**
   - Check browser console for detailed error messages
   - Verify API routes are returning proper JSON responses
   - Check network tab for response status codes

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run TypeScript scripts
npx tsx scripts/script-name.ts

# Add shadcn/ui components
npx shadcn@latest add [component-name]
```

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v3
- **Authentication**: NextAuth.js
- **Database**: MongoDB
- **Password Hashing**: bcrypt
- **MFA**: otplib authenticator-app TOTP
- **Charts**: Recharts
- **PDF Export**: jsPDF
- **CSV Export/Import**: Built-in CSV utilities
- **Barcode Generation**: react-barcode
- **QR Code Generation**: qrcode.react
- **Barcode Scanning**: @zxing/library

## Recent Updates

### Latest Features
- ✅ Sortable student table columns
- ✅ Smart Fill for cabinet forms
- ✅ School filtering on cabinets page
- ✅ Test data seeding tools
- ✅ Smart cabinet seeding
- ✅ Enhanced dashboard statistics
- ✅ Print reports and analytics
- ✅ Saved search filters
- ✅ Barcode scanner integration
- ✅ QR code generation with student ID, name, DOB, cabinet, drawer, and school
- ✅ Reprint functionality
- ✅ Label stock tracking
- ✅ Enhanced audit log page
- ✅ Dark mode support
- ✅ Component extraction and reusability
- ✅ Brother printer optimization
- ✅ Improved error handling and validation
- ✅ Self-service password changes
- ✅ Authenticator-app MFA enrollment
- ✅ Admin password/MFA recovery panel
- ✅ Role permission preview
- ✅ Cabinet health dashboard
- ✅ Student import preview with duplicate/date/status validation
- ✅ Duplicate student detector
- ✅ Unassigned student queue
- ✅ Bulk move tool
- ✅ Activity report
- ✅ Label print queue/history
- ✅ Data cleanup center
- ✅ School/program configuration
- ✅ CSV template and sample files for bulk upload
- ✅ Production build fixes for Next.js 16

## Contributing

1. Follow the existing code style
2. Add appropriate error handling
3. Update documentation for new features
4. Test thoroughly before submitting

## License

This project is developed for the Department of Education (DOE) and is proprietary software.
