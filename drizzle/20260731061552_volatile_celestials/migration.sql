CREATE POLICY "enrollment_faculty_select" ON "academic"."enrollments" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (EXISTS (
    SELECT 1
    FROM academic.section_instructors AS si
    WHERE si.section_id = "academic"."enrollments"."section_id"
      AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "audit_student_select" ON "governance"."audit_events" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (actor_user_account_id = nullif(current_setting('app.user_account_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_faculty_select" ON "governance"."audit_events" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (actor_user_account_id = nullif(current_setting('app.user_account_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_counselor_select" ON "governance"."audit_events" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (actor_user_account_id = nullif(current_setting('app.user_account_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_student_insert" ON "governance"."audit_events" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK (actor_user_account_id = nullif(current_setting('app.user_account_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_faculty_insert" ON "governance"."audit_events" AS PERMISSIVE FOR INSERT TO "arise_app_faculty" WITH CHECK (actor_user_account_id = nullif(current_setting('app.user_account_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_counselor_insert" ON "governance"."audit_events" AS PERMISSIVE FOR INSERT TO "arise_app_counselor" WITH CHECK (actor_user_account_id = nullif(current_setting('app.user_account_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "person_faculty_select" ON "identity"."persons" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (EXISTS (
        SELECT 1
        FROM identity.students AS s
        JOIN academic.enrollments AS e ON e.student_id = s.id
        JOIN academic.section_instructors AS si ON si.section_id = e.section_id
        WHERE s.person_id = "identity"."persons"."id"
          AND e.status = 'enrolled'
          AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      ));--> statement-breakpoint
CREATE POLICY "person_counselor_select" ON "identity"."persons" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
        SELECT 1
        FROM identity.students AS s
        WHERE s.person_id = "identity"."persons"."id"
          AND EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = s.id
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      AND ca.effective_from <= now()
      AND (ca.effective_until IS NULL OR ca.effective_until > now())
  )
      ));--> statement-breakpoint
CREATE POLICY "student_faculty_select" ON "identity"."students" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    JOIN academic.section_instructors AS si ON si.section_id = e.section_id
    WHERE e.student_id = "identity"."students"."id"
      AND e.status = 'enrolled'
      AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "student_counselor_select" ON "identity"."students" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = "identity"."students"."id"
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      AND ca.effective_from <= now()
      AND (ca.effective_until IS NULL OR ca.effective_until > now())
  ));--> statement-breakpoint
CREATE POLICY "case_status_student_insert" ON "services"."case_status_history" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK ("services"."case_status_history"."status" = 'pending'
        AND "services"."case_status_history"."changed_by_employee_id" = (
          SELECT c.assigned_counselor_employee_id
          FROM services.cases AS c
          WHERE c.id = "services"."case_status_history"."case_id"
            AND c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
            AND c.source = 'support_signal'
        ));--> statement-breakpoint
CREATE POLICY "case_status_faculty_insert" ON "services"."case_status_history" AS PERMISSIVE FOR INSERT TO "arise_app_faculty" WITH CHECK ("services"."case_status_history"."status" = 'pending'
        AND "services"."case_status_history"."changed_by_employee_id" = (
          SELECT ca.counselor_employee_id
          FROM services.counselor_referrals AS cr
          JOIN services.counselor_assignments AS ca ON ca.student_id = cr.student_id
          WHERE cr.case_id = "services"."case_status_history"."case_id"
            AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
            AND ca.effective_from <= now()
            AND (ca.effective_until IS NULL OR ca.effective_until > now())
          ORDER BY ca.effective_from DESC
          LIMIT 1
        ));--> statement-breakpoint
CREATE POLICY "case_status_counselor_insert" ON "services"."case_status_history" AS PERMISSIVE FOR INSERT TO "arise_app_counselor" WITH CHECK (EXISTS (
    SELECT 1
    FROM services.cases AS c
    WHERE c.id = "services"."case_status_history"."case_id"
      AND (
        c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR c.assigned_counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  )
        AND "services"."case_status_history"."changed_by_employee_id" = nullif(current_setting('app.employee_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "case_student_insert" ON "services"."cases" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK ("services"."cases"."source" = 'support_signal'
        AND "services"."cases"."source_support_signal_id" IS NOT NULL
        AND "services"."cases"."student_id" = nullif(current_setting('app.student_id', true), '')::uuid
        AND EXISTS (
          SELECT 1
          FROM services.support_signals AS ss
          WHERE ss.id = "services"."cases"."source_support_signal_id"
            AND ss.student_id = "services"."cases"."student_id"
            AND ss.recipient_counselor_employee_id = "services"."cases"."assigned_counselor_employee_id"
        ));--> statement-breakpoint
CREATE POLICY "case_faculty_insert" ON "services"."cases" AS PERMISSIVE FOR INSERT TO "arise_app_faculty" WITH CHECK ("services"."cases"."source" = 'faculty_referral'
        AND "services"."cases"."source_support_signal_id" IS NULL
        AND EXISTS (
          SELECT 1
          FROM services.counselor_referrals AS cr
          WHERE cr.student_id = "services"."cases"."student_id"
            AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
            AND cr.case_id IS NULL
        )
        AND EXISTS (
          SELECT 1
          FROM services.counselor_assignments AS ca
          WHERE ca.student_id = "services"."cases"."student_id"
            AND ca.counselor_employee_id = "services"."cases"."assigned_counselor_employee_id"
            AND ca.effective_from <= now()
            AND (ca.effective_until IS NULL OR ca.effective_until > now())
        ));--> statement-breakpoint
CREATE POLICY "counselor_assignment_faculty_select" ON "services"."counselor_assignments" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    JOIN academic.section_instructors AS si ON si.section_id = e.section_id
    WHERE e.student_id = "services"."counselor_assignments"."student_id"
      AND e.status = 'enrolled'
      AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "counselor_referral_faculty_update" ON "services"."counselor_referrals" AS PERMISSIVE FOR UPDATE TO "arise_app_faculty" USING (nullif(current_setting('app.employee_id', true), '')::uuid = "services"."counselor_referrals"."referred_by_employee_id") WITH CHECK (nullif(current_setting('app.employee_id', true), '')::uuid = "services"."counselor_referrals"."referred_by_employee_id");--> statement-breakpoint
CREATE POLICY "intervention_note_counselor_insert" ON "services"."intervention_notes" AS PERMISSIVE FOR INSERT TO "arise_app_counselor" WITH CHECK (EXISTS (
    SELECT 1
    FROM services.cases AS c
    WHERE c.id = "services"."intervention_notes"."case_id"
      AND (
        c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR c.assigned_counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  )
        AND "services"."intervention_notes"."author_employee_id" = nullif(current_setting('app.employee_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "referral_status_faculty_insert" ON "services"."referral_status_history" AS PERMISSIVE FOR INSERT TO "arise_app_faculty" WITH CHECK (EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        WHERE cr.id = "services"."referral_status_history"."referral_id"
          AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
      AND "services"."referral_status_history"."changed_by_employee_id" = nullif(current_setting('app.employee_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "referral_status_counselor_insert" ON "services"."referral_status_history" AS PERMISSIVE FOR INSERT TO "arise_app_counselor" WITH CHECK (EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        WHERE cr.id = "services"."referral_status_history"."referral_id"
          AND EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = cr.student_id
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      AND ca.effective_from <= now()
      AND (ca.effective_until IS NULL OR ca.effective_until > now())
  )
      )
      AND "services"."referral_status_history"."changed_by_employee_id" = nullif(current_setting('app.employee_id', true), '')::uuid);--> statement-breakpoint
ALTER POLICY "financial_hold_counselor_select" ON "integration"."financial_hold_snapshots" TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = "integration"."financial_hold_snapshots"."student_id"
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      AND ca.effective_from <= now()
      AND (ca.effective_until IS NULL OR ca.effective_until > now())
  ));--> statement-breakpoint
ALTER POLICY "counselor_referral_faculty_insert" ON "services"."counselor_referrals" TO "arise_app_faculty" WITH CHECK (nullif(current_setting('app.employee_id', true), '')::uuid = "services"."counselor_referrals"."referred_by_employee_id"
        AND EXISTS (
          SELECT 1
          FROM academic.section_instructors AS si
          WHERE si.section_id = "services"."counselor_referrals"."section_id"
            AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
        )
        AND EXISTS (
          SELECT 1
          FROM academic.enrollments AS e
          WHERE e.section_id = "services"."counselor_referrals"."section_id"
            AND e.student_id = "services"."counselor_referrals"."student_id"
            AND e.status = 'enrolled'
        ));--> statement-breakpoint
ALTER POLICY "counselor_referral_counselor_select" ON "services"."counselor_referrals" TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = "services"."counselor_referrals"."student_id"
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      AND ca.effective_from <= now()
      AND (ca.effective_until IS NULL OR ca.effective_until > now())
  ));