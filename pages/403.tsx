import { ErrorLayout } from "@/components/ErrorLayout";

export default function Error403() {
  return (
    <ErrorLayout
      code="403"
      title="Access Forbidden"
      description="You do not have permission to access this resource or administrative area."
      icon="🚫"
      iconBgColor="bg-red-100"
      iconTextColor="text-red-600"
    />
  );
}
