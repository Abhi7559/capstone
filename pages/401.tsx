import { ErrorLayout } from "@/components/ErrorLayout";

export default function Error401() {
  return (
    <ErrorLayout
      code="401"
      title="Unauthorized Access"
      description="You need to be logged in to view this page or resource."
      icon="🔒"
      iconBgColor="bg-amber-50"
      iconTextColor="text-amber-600"
    />
  );
}
