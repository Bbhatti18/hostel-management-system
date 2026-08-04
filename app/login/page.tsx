"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim();
    const submittedPassword = password;

    if (!normalizedEmail || !submittedPassword) {
      setErrorMessage("Please enter both your email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: submittedPassword,
      });

      if (signInError) {
        setErrorMessage(
          signInError.message.includes("Invalid login credentials")
            ? "The email or password you entered is incorrect."
            : signInError.message || "Unable to sign you in right now. Please try again."
        );
        return;
      }

      if (!authData.session?.user) {
        setErrorMessage("We could not complete the sign-in. Please try again.");
        return;
      }

      const { data: verifiedAuth, error: verificationError } = await supabase.auth.getUser();
      const user = verifiedAuth.user;
      if (verificationError || !user?.email) {
        setErrorMessage("The sign-in did not create a valid session. Please try again.");
        return;
      }

      const lookupEmail = user.email?.toLowerCase() ?? normalizedEmail.toLowerCase();

      const { data: staffUser, error: staffError } = await supabase
        .from("staff_users")
        .select("email, role")
        .ilike("email", lookupEmail)
        .maybeSingle();

      const isAdmin =
        String(staffUser?.role ?? "").trim().toLowerCase() === "admin";

      if (!staffError && isAdmin) {
        window.location.href = "/dashboard";
        return;
      }

      const { data: residentRecord, error: residentError } = await supabase
        .from("residents")
        .select("id, email, status")
        .ilike("email", lookupEmail)
        .maybeSingle();

      const residentIsActive =
        residentRecord?.email &&
        String(residentRecord.status ?? "").trim().toLowerCase() !== "archived";

      if (!residentError && residentIsActive) {
        window.location.href = "/resident-portal";
        return;
      }

      if (staffError) {
        setErrorMessage("Your account access could not be verified. Please try again.");
      } else if (residentError) {
        setErrorMessage("Your resident profile could not be verified. Please try again.");
      } else {
        await supabase.auth.signOut();
        setErrorMessage("No active resident profile is linked to this account.");
      }
    } catch {
      setErrorMessage("Something went wrong while signing you in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-4xl font-bold text-center text-blue-700">
          StayHub
        </h1>

        <p className="mt-2 text-center text-gray-500">
          Hostel Management System
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border p-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border p-3"
          />

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
