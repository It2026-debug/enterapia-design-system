/** Stops the importer from overwriting the repository with data from the wrong .fig file. */
export function assertLooksLikeEnterapia({ stats, foundations, components }) {
  const problems = [];
  if (stats.primitives === 0) problems.push('no variables in a "Primitives" collection');
  if (stats.semantic === 0) problems.push('no variables in a "Semantic" collection');
  if (foundations.length === 0) problems.push('no sections on the "Foundations" page');
  if (components.length === 0) problems.push('no components on the "Components" page');
  if (problems.length > 0) {
    throw new Error(`This does not look like the Enterapia design file (${problems.join("; ")}). Nothing was written.`);
  }
}
