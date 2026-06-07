"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function InputForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Field>
        <Field.Label>Name</Field.Label>
        <Field.Control>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field.Control>
      </Field>
      <Field>
        <Field.Label>Message</Field.Label>
        <Field.Control>
          <Textarea placeholder="Tell us more..." />
        </Field.Control>
      </Field>
    </div>
  );
}
