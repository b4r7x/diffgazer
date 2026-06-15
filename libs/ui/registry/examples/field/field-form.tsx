"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function FieldForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isInvalid = submitted && email.trim() === "";

  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <Field required invalid={isInvalid}>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input
            name="email"
            value={email}
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </Field.Control>
        <Field.Description>Used for review notifications.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>
      <button
        type="submit"
        className="w-fit border border-border px-3 py-1.5 text-xs font-bold uppercase"
      >
        Save
      </button>
    </form>
  );
}
