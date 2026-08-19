import { useState } from "react";
import client from "../../api/client";
import { Card, Field, Input, Button, Banner } from "../../components/ui";

const EMPTY_FORM = {
  account_holder_name: "",
  account_number: "",
  ifsc_code: "",
  bank_name: "",
};

export default function BankStep({ onNext, initialData }) {
  const [form, setForm] = useState(() =>
    initialData
      ? {
          account_holder_name: initialData.account_holder_name ?? "",
          account_number: initialData.account_number ?? "",
          ifsc_code: initialData.ifsc_code ?? "",
          bank_name: initialData.bank_name ?? "",
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/application/bank-account", form);
      onNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink mb-1">Add Bank Account</h2>
      <p className="text-sm text-ink500 mb-6">
        We'll send your disbursed loan amount to this account.
      </p>

      <Banner type="error">{error}</Banner>

      <form onSubmit={handleSubmit}>
        <Field label="Account holder name">
          <Input value={form.account_holder_name} onChange={set("account_holder_name")} required />
        </Field>
        <Field label="Account number">
          <Input value={form.account_number} onChange={set("account_number")} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="IFSC code">
            <Input
              value={form.ifsc_code}
              onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
              required
            />
          </Field>
          <Field label="Bank name">
            <Input value={form.bank_name} onChange={set("bank_name")} required />
          </Field>
        </div>

        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Saving…" : initialData ? "Update & Continue" : "Continue to Declaration"}
        </Button>
      </form>
    </Card>
  );
}
