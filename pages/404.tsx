import { ErrorLayout } from "@/components/ErrorLayout";

export default function Custom404() {
  return (
    <ErrorLayout
      code="404"
      title="Page Not Found"
      description="The page or project resource you are looking for doesn't exist or has been moved."
      icon="🔍"
      iconBgColor="bg-blue-50"
      iconTextColor="text-blue-600"
    />
  );
}
