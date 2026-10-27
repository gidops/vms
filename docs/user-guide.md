# User guide

**Who this is for:** anyone who uses the Visitor Management System (VMS) day to
day, or needs to explain it to others: reception, security, staff, gate officers
and administrators. No technical knowledge is needed. **What you'll learn:** who
does what, how a visit moves from request to check-out, and where each screen is.

The VMS keeps track of every visitor to the Afreximbank African Trade Centre
(AATC) in Abuja. Staff invite guests, the Security Manager approves them,
reception checks them in and hands out a badge, and the system records each
step.

## Signing in

1. Open the VMS address in a browser and sign in with your email and password.
2. You land on the home screen for your role (see the table below).
3. If you hold more than one role, use the **role switcher** in the top bar to
   change roles. What you can see and do changes with the role.
4. The **account menu** (your name, top right) has **Account Settings**,
   **Insights**, **Operations** (System Admin only) and **Logout**.
5. Use the language switcher to change between English, French and Arabic.

Forgot your password? Use **Forgot password?** on the sign-in screen.

The very first time the system is installed, there are no users. The first
person to open the **Create admin account** screen (`/signup`) becomes the
System Admin. After that, the screen closes and every other account is created
by the System Admin under **Users**.

## Roles

| Role (shown as)  | Code name     | Home screen  | What they do                                                                                                                                                                |
| ---------------- | ------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System Admin     | `SUPER_ADMIN` | `/admin`     | Everything. Manages users and roles, runs **Operations** (access cards, walk-in QR, audit trail), can add a person back to the email list.                                  |
| Security Manager | `ADMIN`       | `/admin`     | Approves or denies visit requests, flags visits for security review, asks for more information, resolves alerts. Sees analytics and can export visitor data. No user admin. |
| VMC Reception    | `VMC`         | `/dashboard` | Works the Visitor Management Centre (VMC) desk: registers walk-ins, creates invites, checks visitors in and out, hands out badges, records email opt-outs, exports data.    |
| Staff            | `STAFF`       | `/staff`     | Hosts visitors: creates invite requests for their own guests, follows their progress, answers the Security Manager, cancels, and rates guests after the visit.              |
| Gate             | `GATE`        | `/gate`      | Gate officers. Can view the evacuation roll. (The gate home screen is a placeholder for now.)                                                                               |

**Add-on roles** are extra rights given on top of a main role. They never
appear in the role switcher.

| Add-on     | Added to      | What it adds                                                                                               |
| ---------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| VMC Admin  | VMC Reception | The facility-wide **Visitors** directory and **Analytics** on the Insights page.                           |
| Read Admin | Staff         | Read-only, facility-wide Insights (Overview, History, Visitors, Analytics, email consent list). No export. |

Staff only ever see visits they created or host. Reception, the Security
Manager and the System Admin see all visits.

## The life of a visit

A visit starts in one of three ways, then moves through the same steps.

```
Invite ──▶ Awaiting Approval ──▶ Expected ──▶ Onsite ──▶ Checked Out ──▶ Rated
                │      ▲             │
                ▼      │             ▼
         Needs More Info         Flagged (security hold until resolved)
                │
                ▼
             Denied / Cancelled
```

### 1. The visit is created

**a) Invite (planned visit).** Staff press **New Invite Request** on their
home screen; reception can do the same from **Quick actions**.

1. Fill in **Guest Details**: full name, email, telephone, organisation.
2. Fill in **Visit Details**: host, floor, visit purpose, visit date and time,
   optional notes.
3. Answer the two **Safety & consent** questions for the guest: does the guest
   need help evacuating in an emergency (and what kind), and do they want
   updates on Afreximbank events?
4. To invite several people, press **Add Guest**, or **Import guests from CSV**
   (use **Download CSV Template** first). Tick **Group visit** to name the group.
5. Press **Review Details**, check the summary, then **Create Invite**.

The request now shows **Awaiting Approval** (also "Awaiting SM Approval").

**b) Walk-in (no appointment).** Reception presses **Register Walk-In** and
fills in the same form. Walk-ins do not need the Security Manager's approval;
they go straight to **Expected**.

**c) Self-registration with the walk-in QR.** A printed QR poster sits on the
VMC desk.

1. The visitor scans the QR with their phone and fills in **Register your
   visit** (contact details, who they are visiting, purpose, safety questions).
2. They press **Register my visit**. The system emails a 6-digit code to the
   reception inbox set up on the **Walk-in QR** screen.
3. Reception reads the code to the visitor, who types it in and presses
   **Confirm**. The form and the code each have a time limit; too many wrong
   codes lock the form.
4. The visitor sees **You're registered** and shows the reference at the desk.

The visit is created as a walk-in for today, so no approval is needed. If the QR
has been disabled, the phone shows "Please register at the VMC desk".

### 2. The Security Manager decides

The Security Manager sees new requests on the admin console (**Pending
approvals**, oldest first) and in **Requests & Alerts**. Opening a request shows
the visit details. The choices are:

| Button           | What happens                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Approve**      | Status becomes **Expected**. The guest is sent their invite code and QR by email (and SMS/WhatsApp if switched on). The host gets an update.                       |
| **Deny**         | A reason is required. Status becomes **Denied** and the host is told.                                                                                              |
| **Request Info** | Status becomes **Needs More Info** and an "Additional Information Required" alert is raised. The host sees it as **SM Feedback** in **Updates**.                   |
| **Flag Visit**   | Describe the concern. Status becomes **Flagged** and a "Security Review Required" alert is raised. The guest **cannot be checked in** until the alert is resolved. |

Groups can be decided in one go: **Approve All**, or select guests and use
**Approve Selected** / **Reject Selected**.

When more information was requested, the host opens the request, presses **Edit
Request**, makes the changes and presses **Resubmit Request**. It goes back to
**Awaiting Approval**.

The host (or whoever created the request) can **Cancel Request** at any time
before the visit, and can use **Send CODE to guest** to resend the invite code.

### 3. Check-in at the VMC desk

1. On the reception dashboard (**Today's Schedule**), find the guest in
   **Visitor Records**. Search by visitor, host, floor or pass id.
2. Ask for the invite code and check it matches.
3. Press **Check-In**, choose a badge under **Assign pass**, and press
   **Complete Check-in**. For groups, use **Check-In All**.
4. The guest is now **Onsite**. The host is notified that their guest arrived.

Check-in is refused if the visit is not approved or has an open security alert.

### 4. Check-out

1. Find the guest (status **Onsite**) and press **Check-Out**.
2. Collect the badge. Use **Change Pass ID** if the badge differs from the one
   recorded.
3. Press **Complete Check-Out**. The badge goes back into the pool and the guest
   is sent a thank-you message.

### 5. Rating

After check-out, the host or the person who created the request can open the
visit and give the guest a score from 1 to 5 under **Rate Guest**.

## Alerts

An **alert** is a security notice attached to a visit. Alerts appear in
**Requests & Alerts** (tab **Alerts**) with a risk level (Low, Medium, High,
Critical).

- The Security Manager raises them (**Flag Visit**, **Request Info**) and is the
  only role (with the System Admin) that can **Resolve** them.
- Reception and staff can reply with **Add Note** but cannot resolve.
- Resolving the last open alert lifts the hold: a flagged visit goes back to
  **Expected**; a "needs more info" visit goes back to **Awaiting Approval**.

## Screens by role

### VMC Reception (`/dashboard`)

- **Today's Schedule**: counts (Onsite Visitors, Checked-in Today,
  Checked-Out Today), **Quick actions** (**Register Walk-In**, **New Invite
  Request**), and **Visitor Records** with filters for Today, Last 7 days or a
  custom range.
- **Requests & Alerts** (`/requests`): a feed of requests and alerts with tabs
  **All**, **Requests** and **Alerts**. The number on the tab is your unread
  count.
- **Visit Details** panel: opens from any row. Shows guest information, host and
  floor, visit progress, notes, and **Notifications** (whether each email, SMS
  or WhatsApp message was sent). A failed message can be resent with **Retry**.

### Staff (`/staff`)

- **Today's Schedule**: Expected Today, Awaiting Approval, Onsite, your office
  floor, and **New Invite Request**.
- **My Visits** (`/staff/visits`): every visit you created or host, with status
  and **Update** / **View Details**.
- **Updates** (`/staff/updates`): news about your visits, grouped as Arrival
  Update, SM Feedback, Request Update, Visit Status and Security Alerts.

### Security Manager and System Admin (`/admin`)

The admin console opens on **Overview**: Awaiting approval, Onsite now and
Expected today, the **Pending approvals** list (Approve / Deny / Review group),
today's visitors and recent activity. The side menu has **Requests &
Approvals**, **Users & Staff Roles** (System Admin only) and **Settings**. Some
menu items are marked **Coming soon**.

A redesigned console is being built at `/admin/v2` (tabs **Overview**, **Pending
Approvals** for the Security Manager, **Recent Activity**, and **Users** for the
System Admin). Both work today; the new one will replace the old one once it is
signed off. See [admin-console-v2.md](./admin-console-v2.md).

**Users** (System Admin): **New user**, **Edit roles** and **Delete**. Add-on
roles are labelled "Add-on for …" in the role picker.

### Gate (`/gate`)

A placeholder home screen and an **Evacuation Roll** button.

## Insights (`/insights`)

Open from the account menu. Each tab appears only if your role allows it.

| Tab                 | What it shows                                                                                                                                            | Who sees it                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Overview**        | Today at a glance: on site now, visitors today, still expected, checked out.                                                                             | System Admin, Read Admin                                                                                 |
| **Evacuation Roll** | See below.                                                                                                                                               | System Admin, Security Manager, VMC, Gate                                                                |
| **History**         | Every visit in a date range, searchable, with **Export**.                                                                                                | Facility-wide: System Admin, Security Manager, VMC, Read Admin. Staff see their own visits.              |
| **Visitors**        | Visitor directory and visit history per person. The **Email consent** view lists who agreed to event updates.                                            | Facility-wide: System Admin, Security Manager, VMC Admin, Read Admin. Staff see people who visited them. |
| **Analytics**       | Visitor volume by day, week and hour, outcomes, walk-ins vs invited, repeat visitors, busiest hosts, and (for security roles) flags, alerts and denials. | Facility-wide: System Admin, Security Manager, VMC Admin, Read Admin. Staff see their own visits.        |

**Exporting visitor data.** Roles with export rights (System Admin, Security
Manager, VMC) can download visitor data as CSV or Excel for up to 366 days.
Exports contain personal data and are recorded in the audit trail.

## Evacuation roll

The evacuation roll lists every visitor **currently on site** who said they
would need help evacuating in an emergency, with the help needed (mobility,
visual, hearing, medical, other), floor, host, phone and badge.

- Open it from **Insights → Evacuation Roll**, from **View roll** on the
  dashboards, or from the Gate screen.
- Press **Refresh** for the latest list and **Print** for a paper copy.

## Email consent (opt-ins)

When a visit is created, the guest is asked whether they want updates on
Afreximbank events. The latest answer is kept per email address.

| Action                                                  | Who                                             |
| ------------------------------------------------------- | ----------------------------------------------- |
| View the list (**Insights → Visitors → Email consent**) | System Admin, Security Manager, VMC, Read Admin |
| **Export CSV** of people who consented                  | System Admin, Security Manager, VMC             |
| **Withdraw** / **Remove consent** for an email          | System Admin, VMC                               |
| **Add consent** back (only if the person agreed)        | System Admin only                               |

A withdrawn person can opt in again by saying yes at a later visit.

Note: the list lives inside the **Visitors** tab, which a VMC Reception user
only sees with the **VMC Admin** add-on.

## Operations (`/operations`, System Admin only)

### Access cards

Personalised RFID access cards for visitors who need one, often for several
days. (These are different from the shared badges handed out at check-in.)

1. Press **Assign card**, find the visitor, optionally link a visit.
2. Enter the **Card number** printed on or encoded in the card. New numbers are
   added to the **Card registry**.
3. Set **Valid from** and **Valid until** (West Africa Time), add a photo
   (**Upload photo** or **Take photo**), then **Assign card**.
4. Open the card and press **Print card**. Use a card printer set to CR80,
   portrait, both sides.
5. When the visitor leaves, open the card and choose **Card returned** or
   **Card lost**.

Views: **Out now** (cards currently out, with overdue warnings), **History** and
**Card registry** (where a card can be marked found, reinstated or retired).

### Walk-in QR

Manage the QR poster used for self-registration.

1. **Create walk-in QR** and enter the email address that receives the 6-digit
   codes. Use an inbox someone at the VMC desk reads.
2. **Print poster** or **Download PNG** and place it on the desk.
3. **Disable** stops the QR working; **Enable** turns it back on.
4. **New QR** replaces the code. The old poster stops working at once, so print
   the new one first.

### Audit trail

A read-only record of everything that happened: sign-ins, approvals,
check-ins, exports, user changes and more. Filter by date range and category,
search by action, user or reference, open any row for details, and **Export
CSV**.

## Account Settings (`/settings`)

- **Profile Information**: name, phone, photo, password.
- **My Desk**: your assigned desk or floor (staff use this for their office
  floor).
- **Security/Preferences**: login activity, language, and which notifications
  you want (new invite request, SM approved, SM denied, flagged visitor).

## Glossary

| Term         | Meaning                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| VMC          | Visitor Management Centre: the reception desk where visitors are checked in. |
| SM           | Security Manager.                                                            |
| Host         | The staff member the visitor is coming to see.                               |
| Badge / pass | The shared visitor badge handed out at check-in and returned at check-out.   |
| Access card  | A personalised RFID card printed for a specific visitor (Operations).        |
| Walk-in      | A visitor who arrives without an invite.                                     |
| WAT          | West Africa Time, used for all dates and times in the system.                |
