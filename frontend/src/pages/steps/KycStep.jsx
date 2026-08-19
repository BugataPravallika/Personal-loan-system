import { useState } from "react";
import client from "../../api/client";
import { Card, Field, Input, Select, Button, Banner } from "../../components/ui";

const EMPTY_FORM = {
  full_name: "",
  dob: "",
  gender: "Female",
  address: "",
  id_type: "PAN",
  id_number: "",
};

export default function KycStep({ onNext, initialData }) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          full_name: initialData.full_name ?? "",
          dob: initialData.dob ?? "",
          gender: initialData.gender ?? "Female",
          address: initialData.address ?? "",
          id_type: initialData.id_type ?? "PAN",
          id_number: initialData.id_number ?? "",
        }
      : EMPTY_FORM
  );
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/application/kyc", form);
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await client.post("/application/kyc/id-document", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      onNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Know Your Customer (KYC)</h2>
      <p className="text-sm text-ink500 mb-6">Tell us who you are — this stays on file with your application.</p>

      <Banner type="error">{error}</Banner>

      <form onSubmit={handleSubmit}>
        <Field label="Full name (as per ID)">
          <Input value={form.full_name} onChange={set("full_name")} required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of birth">
            <Input type="date" value={form.dob} onChange={set("dob")} required />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={set("gender")}>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
              <option>Prefer not to say</option>
            </Select>
          </Field>
        </div>

        <Field label="Current address">
          <textarea
            value={form.address}
            onChange={set("address")}
            required
            rows={3}
            className="w-full rounded-lg border border-hairline px-3.5 py-2.5 text-sm text-ink900 focus:border-teal transition-colors"
            placeholder="House / street, city, state, PIN code"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="ID type">
            <Select value={form.id_type} onChange={set("id_type")}>
              <option value="PAN">PAN</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="Passport">Passport</option>
              <option value="Voter ID">Voter ID</option>
            </Select>
          </Field>
          <Field label="ID number">
            <Input value={form.id_number} onChange={set("id_number")} required />
          </Field>
        </div>

        <Field
          label="Upload ID document (optional)"
          hint={
            initialData?.id_document_path
              ? "A document is already on file. Upload again only if you want to replace it."
              : "JPG, PNG or PDF"
          }
        >
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-ink500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-light file:px-4 file:py-2 file:text-teal-dark file:text-sm file:font-medium"
          />
        </Field>

        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Saving…" : initialData ? "Update & Continue" : "Continue to Eligibility"}
        </Button>
      </form>
    </Card>
  );
}
