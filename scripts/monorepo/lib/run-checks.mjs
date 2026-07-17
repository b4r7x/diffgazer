// Shared tail for the monorepo validation scripts. They collect a list of
// failure messages, then either
// report them and set a non-zero exit code so CI gates can branch on it, or
// print a success line. Centralizing this keeps the exit-code contract and the
// "fail header + lines, else success" shape identical across the scripts.
//
// `failures` is the list of failure message strings (empty when everything
// passed). `failureHeader` is printed before the failures via console.error;
// pass an empty `failures` list to print only the header when the per-check
// detail was already emitted inline (check-invariants prints PASS/FAIL lines as
// it goes). `successMessage` is printed via console.log when there are no
// failures.
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
