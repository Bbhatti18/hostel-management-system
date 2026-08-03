"use client";

import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase";

const supabase = createBrowserClient();

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!normalizedEmail || !trimmedPassword) {
      setErrorMessage("Please enter both your email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        setErrorMessage(
          signInError.message.includes("Invalid login credentials")
            ? "The email or password you entered is incorrect."
            : signInError.message || "Unable to sign you in right now. Please try again."
        );
        return;
      }

      const user = authData?.user;
      if (!user) {
        setErrorMessage("We could not complete the sign-in. Please try again.");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setErrorMessage(`Session error: ${sessionError.message}`);
        return;
      }

      if (!sessionData.session) {
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
        .select("email")
        .ilike("email", lookupEmail)
        .maybeSingle();

      if (!residentError && residentRecord?.email) {
        window.location.href = "/resident-portal";
        return;
      }

      if (staffError) {
        setErrorMessage(`Role lookup error: ${staffError.message}`);
      } else if (residentError) {
        setErrorMessage(`Role lookup error: ${residentError.message}`);
      } else {
        setErrorMessage("Your account does not have access to the system yet.");
      }
    } catch (error) {
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