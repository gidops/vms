// Re-export the variant authoring API so components import it from one place.
// `tv` is configured with tailwind-merge so slot/variant classes resolve
// conflicts the same way `cn` does.
export { tv, type VariantProps } from "tailwind-variants";
