/**
 * Error types for the Property Search Shortlist system.
 */

/** A single field-level validation error */
export interface ValidationError {
  field: string;
  message: string;
}

/** Result of validating search criteria */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Error that occurs during a specific pipeline stage */
export interface PipelineError {
  stage: "validation" | "geocoding" | "listing_fetch" | "commute" | "assembly";
  message: string;
}

/** Structured error response returned to the user */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable error code
    stage: string;          // Pipeline stage where error occurred
    message: string;        // Human-readable description
    fields?: string[];      // Affected input fields (for validation errors)
    retryable: boolean;     // Whether the user should try again
  };
}
