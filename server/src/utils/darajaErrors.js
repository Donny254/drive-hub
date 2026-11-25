const DEFINITIONS = {
  "0": {
    category: "success",
    title: "Successful result",
    description: "The provider reported a successful result.",
    action: "Verify transaction amount, receipt and transaction association before settlement.",
  },
  "1": {
    category: "customer",
    title: "Insufficient funds",
    description: "Commonly reported as insufficient funds.",
    action: "Ask the customer to check their balance. Do not retry automatically.",
  },
  "1001": {
    category: "conflict",
    title: "Transaction already in progress",
    description: "A conflicting or active transaction may be preventing processing.",
    action: "Wait and check transaction status before initiating another request.",
  },
  "1032": {
    category: "cancelled",
    title: "Customer cancelled",
    description: "The transaction was cancelled by the customer.",
    action: "Allow the customer to initiate a new payment if appropriate.",
  },
  "1037": {
    category: "timeout",
    title: "Customer unreachable or transaction timed out",
    description: "The transaction may have timed out or the customer may not have been reachable.",
    action: "Check transaction status before retrying.",
  },
  "2001": {
    category: "customer",
    title: "PIN or authorization failure",
    description: "Commonly associated with customer authorization or PIN-related failure.",
    action: "Use the provider description. Do not retry automatically.",
  },
  "2029": {
    category: "unresolved",
    title: "Unresolved transaction result",
    description: "Safaricom returned an unresolved result in the transaction query.",
    action: "Keep the transaction pending and reconcile later. Do not mark paid or failed from this code alone.",
  },
  C2B00011: {
    category: "validation",
    title: "Invalid MSISDN",
    description: "The mobile number is invalid.",
    action: "Validate the mobile number.",
  },
  C2B00012: {
    category: "validation",
    title: "Invalid account number",
    description: "The account reference is invalid.",
    action: "Check the payment account reference.",
  },
  C2B00013: {
    category: "validation",
    title: "Invalid amount",
    description: "The payment amount is invalid.",
    action: "Validate the amount and payment rules.",
  },
  C2B00014: {
    category: "validation",
    title: "Invalid KYC details",
    description: "The KYC details were rejected.",
    action: "Review the required KYC information.",
  },
  C2B00015: {
    category: "validation",
    title: "Invalid shortcode",
    description: "The receiving shortcode is invalid.",
    action: "Verify the shortcode.",
  },
  C2B00016: {
    category: "validation",
    title: "Other C2B validation error",
    description: "The payment validation failed for another reason.",
    action: "Review the raw provider payload and logs.",
  },
  "400.003.01": {
    category: "authentication",
    title: "Invalid access token",
    description: "The access token may be invalid or expired.",
    action: "Renew the token and retry once if the operation is safe.",
  },
  "400.003.02": {
    category: "request",
    title: "Bad request",
    description: "The request cannot be processed.",
    action: "Validate required fields and request structure.",
  },
  "400.002.05": {
    category: "request",
    title: "Invalid request payload",
    description: "The request payload is invalid.",
    action: "Validate the payload against the API contract.",
  },
  "404.003.01": {
    category: "endpoint",
    title: "Resource not found",
    description: "The requested provider resource was not found.",
    action: "Verify the API endpoint and environment.",
  },
  "404.001.04": {
    category: "authentication",
    title: "Invalid authenticator header",
    description: "The authentication header may be incorrectly formatted.",
    action: "Verify the HTTP method and Authorization header.",
  },
  "500.003.03": {
    category: "rate_limit",
    title: "Quota violation",
    description: "The request rate may exceed the provider quota.",
    action: "Throttle requests and retry with backoff.",
  },
  "500.003.02": {
    category: "rate_limit",
    title: "Spike arrest violation",
    description: "The provider may be blocking excessive requests.",
    action: "Reduce request rate and investigate request spikes.",
  },
  "500.003.1001": {
    category: "registration",
    title: "Registration conflict or provider error",
    description: "This code can be associated with registration conflicts or provider-side errors.",
    action: "Review the exact provider response and existing URL registration.",
  },
};

export const normalizeDarajaCode = (value) => {
  if (value === null || value === undefined) return null;
  const code = String(value).trim();
  return code || null;
};

export const describeDarajaCode = (value) => {
  const code = normalizeDarajaCode(value);
  if (!code) {
    return {
      code: null,
      category: "unknown",
      title: "Missing provider code",
      description: "The provider response did not include a recognizable result code.",
      action: "Inspect the raw response.",
      known: false,
    };
  }
  const definition = DEFINITIONS[code];
  if (definition) return { code, ...definition, known: true };
  return {
    code,
    category: "unknown",
    title: `Unknown Daraja result (${code})`,
    description: "This result code is not in the local catalogue.",
    action: "Preserve the provider description and raw payload. Do not infer payment success or failure from an unknown code.",
    known: false,
  };
};

export const normalizeDarajaResponse = ({ stage, httpStatus = null, response = {}, error = null }) => {
  const code =
    response?.ResultCode ??
    response?.ResponseCode ??
    response?.responseCode ??
    response?.ResponseStatus ??
    response?.["Response Status"] ??
    response?.errorCode ??
    response?.ErrorCode ??
    null;
  const normalized = describeDarajaCode(code);
  const description =
    response?.ResultDesc ??
    response?.ResponseDescription ??
    response?.ResponseMessage ??
    response?.CustomerMessage ??
    response?.errorMessage ??
    response?.["Response Description"] ??
    response?.["Response Message"] ??
    error?.message ??
    normalized.description;
  return {
    stage,
    code: normalized.code,
    category: normalized.category,
    title: normalized.title,
    description: String(description || normalized.description),
    action: normalized.action,
    known: normalized.known,
    httpStatus,
    raw: response,
  };
};

export const getDarajaErrorCatalogue = () =>
  Object.entries(DEFINITIONS).map(([code, definition]) => ({ code, ...definition }));
