import {
  isRouteErrorResponse,
  useParams,
  useRouteError,
} from "react-router";

type StatusHandler = (info: {
  error: ErrorResponse;
  params: Record<string, string | undefined>;
}) => React.ReactNode;

type ErrorResponse = {
  status: number;
  statusText: string;
  data: unknown;
};

export function GeneralErrorBoundary({
  defaultStatusHandler = ({ error }) => (
    <p>
      {error.status} {error.statusText}
    </p>
  ),
  statusHandlers,
  unexpectedErrorHandler = (error) => (
    <p>{getErrorMessage(error)}</p>
  ),
}: {
  defaultStatusHandler?: StatusHandler;
  statusHandlers?: Record<number, StatusHandler>;
  unexpectedErrorHandler?: (error: unknown) => React.ReactNode;
}) {
  const error = useRouteError();
  const params = useParams();

  if (typeof document !== "undefined") {
    console.error(error);
  }

  return (
    <div className="container mx-auto flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      {isRouteErrorResponse(error)
        ? (statusHandlers?.[error.status] ?? defaultStatusHandler)({
            error,
            params,
          })
        : unexpectedErrorHandler(error)}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  console.error("Unhandleable error", error);
  return "Unknown error";
}