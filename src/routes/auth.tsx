import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Phone, ShieldCheck, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { backend, isBackendConfigured } from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Telegram Auto Forward" },
      { name: "description", content: "Sign in with your Telegram phone number." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // If already signed in, leave the auth page.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    if (!isBackendConfigured()) {
      toast.error("Backend URL not configured. Set VITE_BACKEND_URL.");
      return;
    }
    setLoading(true);
    try {
      const res = await backend.sendOtp(phone.trim());
      setPhoneCodeHash(res.phone_code_hash);
      setStep("otp");
      toast.success("OTP sent via Telegram");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 5) return;
    setLoading(true);
    try {
      const raw = await backend.verifyOtp({ phone: phone.trim(), code });
      console.log("verify-otp response:", raw);
      // Be tolerant of different backend response shapes.
      const res: any = raw;
      const token: string | undefined =
        res?.token;
      const user = res?.user ?? res?.data?.user;
      const ok = res?.success === true;
      if (!ok || !token) {
        throw new Error(res?.error || res?.message || "Invalid verification response");
      }
      localStorage.setItem("auth_token", token);
      if (user) localStorage.setItem("auth_user", JSON.stringify(user));
      toast.success("Signed in");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Send className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Telegram Auto Forward</span>
        </div>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              {step === "phone" ? <Phone className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
              {step === "phone" ? "Sign in with phone" : "Enter verification code"}
            </CardTitle>
            <CardDescription>
              {step === "phone"
                ? "We'll send a one-time code to your Telegram account."
                : `Code sent to ${phone}. Check your Telegram app.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <form onSubmit={sendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label>Verification code</Label>
                  <InputOTP maxLength={5} value={code} onChange={setCode}>
                    <InputOTPGroup>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep("phone")} disabled={loading}>
                    Change number
                  </Button>
                  <Button type="submit" disabled={loading || code.length < 5} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
                  </Button>
                </div>
              </form>
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/auth" className="underline">terms</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
