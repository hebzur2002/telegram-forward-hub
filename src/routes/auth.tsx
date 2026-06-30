import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Phone, ShieldCheck, Loader2, Send } from "lucide-react";
import { backend, isBackendConfigured, setAuth, getToken } from "@/lib/backend";
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
  const [password, setPassword] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already signed in? Skip to dashboard.
  useEffect(() => {
    if (getToken()) navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    if (!isBackendConfigured()) {
      toast.error("Backend URL not configured. Set VITE_API_URL.");
      return;
    }
    setLoading(true);
    try {
      await backend.sendOtp(phone.trim());
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
      const res = await backend.verifyOtp({
        phone: phone.trim(),
        code,
        ...(needs2fa && password ? { password } : {}),
      });
      if (res.requires_2fa) {
        setNeeds2fa(true);
        toast.message("Two-factor password required");
        return;
      }
      if (!res.token || !res.user) {
        throw new Error("Invalid verification response");
      }
      setAuth(res.token, res.user);
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
                {needs2fa && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Two-factor password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setStep("phone"); setNeeds2fa(false); setCode(""); setPassword(""); }} disabled={loading}>
                    Change number
                  </Button>
                  <Button type="submit" disabled={loading || code.length < 5 || (needs2fa && !password)} className="flex-1">
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
