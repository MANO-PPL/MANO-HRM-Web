# ADR-0003: Multi-Tier Salary Architecture and Payroll Calculation Engine

> Place this file in /docs/adr/, numbered sequentially (0001, 0002, ...).
> One ADR per significant, hard-to-reverse technical decision.
> Once accepted, an ADR is rarely edited — if the decision changes, write a
> new ADR that supersedes this one, don't rewrite history.

## Status
Accepted

## Context
The platform required a robust, scalable, and audit-compliant payroll and compensation subsystem to replace ad-hoc manual salary tracking. A production-grade payroll system must satisfy several complex requirements simultaneously:

1. **Multi-Component Compensation Packages**: Salaries are not single flat numbers; they consist of multiple distinct contractual components including Basic Salary, House Rent Allowance (HRA), Special Allowances, Employee Deductions (Provident Fund, Professional Tax), Employer Retirals (Employer PF, ESI, Gratuity), and non-cash Benefits (Medical Insurance).
2. **Indian Statutory & Regulatory Compliance**: Deductions like Employee PF (12% of Basic) must be distinguished from Employer PF matching contributions. Net Take-Home pay must strictly account for employee deductions, while total Cost to Company (CTC) must include employer retirals and benefits without inflating employee earnings.
3. **Attendance & Biometric Integration**: Payroll must automatically synthesize attendance logs, calculating Loss of Pay (LOP) for unapproved absences and half-days according to configurable divisors (calendar days, 26-day, or 30-day basis), and Overtime (OT) pay based on shift-level overtime authorization.
4. **Historical Immutability & Audit Safety**: Modifying an employee's salary package or tweaking an organization's compensation template today must never retroactively alter historical payslips or past monthly ledger balances.
5. **Formal Salary Structure Generation (Annexure A)**: HR administrators require verifiable interactive previews and standardized printable salary annexures for employment contracts, revisions, and audits.
6. **Zero-DDL Extensibility**: The system needs to support differing policy rules (such as LOP divisors and overtime multipliers) across departments and packages without recurring SQL schema migrations.

## Decision
We implemented a relational, multi-tier compensation architecture backed by a two-stage topological calculation engine and an immutable snapshot ledger.

### 1. Relational Package and Component Structure
- **Package Template (`payroll_salary_packages`)**: Scoped to `org_id` with organization-level uniqueness, serving as the master template for employee compensation bands.
- **Contractual Components (`payroll_salary_package_components`)**: Supports both fixed values (`calc_type = 'fixed'`) and base-dependent formulas (`calc_type = 'percent_of_component'`).
- **Self-Referencing Base Component FK**: Percentage-based components reference a parent component within the same package via `FOREIGN KEY (package_id, base_component_id) REFERENCES payroll_salary_package_components(package_id, id)`.
- **Strict 4-Tier Category Constraint**: Enforced at the database level:
  ```sql
  CONSTRAINT chk_payroll_salary_package_component_category
      CHECK (category IN ('earning', 'deduction', 'employer_contribution', 'benefit'))
  ```
  This guarantees that company retirals and benefits are never mixed into employee deductions or gross payout.

### 2. Policy Customization via Package JSON Rules (`packages_rules`)
To eliminate database schema migrations when compensation policies change, packages define an extensible `packages_rules` JSON schema:
- **`lop`**: Configuration for Loss of Pay calculation (`enabled`, `basis`: `'gross'` | `'basic'`, `day_divisor`: `'calendar_days'` | `'fixed_26'` | `'fixed_30'` | `'working_days'`, `deduct_absents`, `deduct_half_days`).
- **`ot`**: Configuration for overtime remuneration (`hourly_rate`, `multiplier`).
- **Shift-Level Guard**: Overtime calculation is strictly gated by `org_shifts.is_overtime_enabled` before applying package OT rates.

### 3. Date-Effective Versioned Salary Assignments (`payroll_employee_salary_assignments`)
Employees are bound to salary packages via temporal assignments with `effective_from` and nullable `effective_to` dates. Salary increments and promotions generate a new assignment record rather than overwriting existing records, preserving retrospective compensation validity.

### 4. Two-Stage Calculation Engine (`PayrollEngineService`)
During payroll execution or preview:
1. **Stage 1 (Contractual Evaluation)**:
   - Evaluates all fixed components first and records them in an amount map.
   - Evaluates percentage components second, resolving against the evaluated parent component amount.
   - Computes contractual gross earnings.
2. **Stage 2 (Attendance & Ledger Synthesis)**:
   - Derives LOP deduction by multiplying absent and half-day units by the daily rate (`basisAmount / divisor`).
   - Derives Overtime earnings if authorized on the employee's shift.
   - Ingests manual adjustments (bonuses, incentives, reimbursements, fines).
   - Computes ledger aggregates:
     - **Gross Earnings** = $\sum \text{Contractual Earnings} + \text{Overtime} + \text{Earning Adjustments}$
     - **Total Deductions** = $\sum \text{Contractual Employee Deductions} + \text{LOP} + \text{Deduction Adjustments}$
     - **Net Salary (Take-Home)** = $\max(0, \text{Gross Earnings} - \text{Total Deductions})$
     - **Employer Contributions** = $\sum \text{Company Retirals (ESI, Co's PF, Gratuity)}$
     - **Cost to Company (CTC)** = $\text{Gross Earnings} + \text{Employer Contributions} + \text{Benefits}$

### 5. Immutable Payroll Runs & Ledger Rows (`payroll_runs_v1`, `payroll_lines`)
- Running payroll produces a header (`payroll_runs_v1`) supporting both bulk batch workforce runs (`employee_id IS NULL`) and individual off-cycle settlements (`employee_id = user_id`), eliminating redundant scope flags.
- Each item is captured as a distinct row in `payroll_lines` with the snapshot title (`name`), component ID (nullable for LOP/OT/adjustments), transaction category, and exact amount.
- Historical runs reference frozen `payroll_lines` records, immunizing past financial records from future package edits or deletions.

### 6. Annexure A UI and Print Preview
The frontend provides a dedicated compensation breakdown modal (`SalaryStructureModal.jsx`):
- **Interactive Card Mode**: Visual cards organizing components into the 4 clear categories with monthly and annualized amounts.
- **Formal Annexure A Printout Mode**: Clean, official document format conforming to print styling (`@media print`), suitable for employment agreements and physical filing.

### 7. Access Control and Role-Based Authorization
- Administrative operations (package creation, employee assignment, run generation, and payslip management) are strictly restricted via `authorize('admin', 'hr')`.
- Employee self-service is restricted to viewing only their assigned package and personal payslips.

## Alternatives Considered
- **Flat Monthly Salary Field on Users Table**: Storing a single numeric value in `core_users`. Rejected because it fails Indian statutory compliance (PF, ESI, PT), cannot generate Annexure A breakdown documents, and cannot adapt to multi-tier allowances.
- **Dynamic Expression Evaluation Engine (eval / JS DSL)**: Allowing users to write arbitrary code strings for salary calculations. Rejected due to security vulnerabilities, non-deterministic performance, and high maintenance risk compared to declarative JSON rules and percentage dependencies.
- **Hardcoding Statutory Percentages in Code**: Hardcoding 12% PF or standard tax rates directly in backend logic. Rejected because statutory applicability varies across wage thresholds, wage ceilings (e.g., PF ₹15,000 cap), and organization-specific benefits packages.
- **Free-Form Component Categories (Unconstrained VARCHAR)**: Allowing arbitrary category strings. Rejected because financial calculations depend on exact classification into earnings vs. employee deductions vs. employer retirals. Check constraints and enum-level validations prevent ledger corruption.

## Consequences
### Positive
- **Statutory Accuracy**: Clean separation between Employee Deductions (reducing Net Pay) and Employer Contributions (cost to company without reducing Net Pay).
- **Audit Compliance**: Completely reproducible historical payroll runs through immutable snapshot lines.
- **Circular Reference & Self-Referencing Immunity**: Component creation and updates strictly validate the dependency graph, rejecting direct self-references (component A &rarr; A) and transitive cycles (A &rarr; B &rarr; A) with informative 400 errors. Chained percentages are resolved in topological order with loop-guard fallbacks in the calculation engine.
- **Extensible Configuration**: New packages and compensation tiers can be onboarded without modifying database tables or altering backend code.
- **Full Attendance Synergy**: Directly links attendance logs, shifts, overtime policies, and compensation into a single automated pipeline.
- **Professional Artifacts**: Built-in support for Annexure A salary breakdowns and printable employment documentation.

### Trade-offs & Operational Requirements
- **Dependency Ordering**: Handled automatically via topological graph traversal. If an unresolved or corrupted base reference exists in legacy data, the engine defaults the component safely to zero rather than crashing or infinite looping.
- **Attendance Finalization**: Running payroll requires attendance logs for the target pay period to be finalized and approved by supervisors before executing payroll runs.
