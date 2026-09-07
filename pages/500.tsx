import { ErrorLayout } from "@/components/ErrorLayout";

export default function Error500() {
  return (
    <ErrorLayout
      code="500"
      title="Internal Server Error"
      description="Something unexpected went wrong on our end. Please check back shortly."
      icon="⚠️"
      iconBgColor="bg-rose-50"
      iconTextColor="text-rose-600"
    />
  );
}
