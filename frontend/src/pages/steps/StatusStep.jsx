import { Card, StageBadge } from "../../components/ui";

const COPY = {
  "Waiting for Admin Review": {
    title: "Your application is with our review team",
    body: "We've received your KYC, eligibility details, EMI selection, bank account and selfie. An admin will review your selfie shortly and confirm your loan.",
  },
  "Approved": {
    title: "Your loan has been approved!",
    body: "Your selfie was verified and your application is approved. Disbursement to your bank account is being finalised.",
  },
  "Rejected": {
    title: "Your application was not approved",
    body: "Your selfie could not be verified. Please contact support or reapply with a clearer photo.",
  },
  "Disbursed": {
    title: "Funds have been disbursed",
    body: "Your loan amount has been sent to your registered bank account. Thank you for choosing EzFinanz.",
  },
};

export default function StatusStep({ stage }) {
  const copy = COPY[stage] || COPY["Waiting for Admin Review"];

  return (
    <Card className="text-center">
      <div className="flex justify-center mb-4">
        <StageBadge stage={stage} />
      </div>
      <h2 className="font-display text-2xl text-ink mb-2">{copy.title}</h2>
      <p className="text-sm text-ink500 max-w-md mx-auto">{copy.body}</p>
    </Card>
  );
}
