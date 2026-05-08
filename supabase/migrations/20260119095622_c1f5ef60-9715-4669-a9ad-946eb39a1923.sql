-- Insert default phone number into app_settings
INSERT INTO public.app_settings (key, label, value)
VALUES ('phone', '聯絡電話', '0932-916-940')
ON CONFLICT (key) DO NOTHING;