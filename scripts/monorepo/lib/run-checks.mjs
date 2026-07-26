// Prints failureHeader + failures via console.error and sets exitCode 1; otherwise prints successMessage.
export function runValidationChecks(failures, { failureHeader, successMessage }) {
  if (failures.length > 0) {
    console.error([failureHeader, ...failures].join("\n"));
    process.exitCode = 1;
    return;
  }

  if (successMessage) {
    console.log(successMessage);
  }
}
