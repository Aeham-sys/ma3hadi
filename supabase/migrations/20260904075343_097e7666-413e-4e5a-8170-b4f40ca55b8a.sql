ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS reminder_template text NOT NULL DEFAULT 'مرحبا {student}، تحية من {institute} 👋
تذكير بخصوص الرصيد المستحق: {amount}
يرجى التسديد بأقرب وقت. شكراً لتعاونكم.';