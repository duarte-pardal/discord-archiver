// @ts-check

import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default tsEslint.config(
	{
		plugins: {
			"@typescript-eslint": tsEslint.plugin,
			"@stylistic": stylistic,
		},
	},
	eslint.configs.recommended,
	...tsEslint.configs.strictTypeChecked,
	...tsEslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parser: tsEslint.parser,
			parserOptions: {
				project: ["./tsconfig.json"],
			},
			ecmaVersion: 2022,
			sourceType: "module",
		},
		rules: {
			"no-inner-declarations": "off",
			"@typescript-eslint/no-empty-function": "off",
			"no-empty": "off",

			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/explicit-module-boundary-types": ["warn", {
				allowArgumentsExplicitlyTypedAsAny: true,
			}],
			"@typescript-eslint/consistent-type-definitions": ["warn", "type"],
			"no-constant-condition": ["error", { checkLoops: false }],
			"@typescript-eslint/no-unnecessary-condition": ["warn", { allowConstantLoopConditions: true }],
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/no-dynamic-delete": "off",
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/no-invalid-void-type": "off",
			"@typescript-eslint/prefer-literal-enum-member": "off",
			"@typescript-eslint/restrict-template-expressions": ["error", {
				allowAny: true,
				allowBoolean: true,
				allowNumber: true,
			}],

			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],

			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",

			"@typescript-eslint/only-throw-error": "off",
			"@typescript-eslint/prefer-promise-reject-errors": "off",

			"@stylistic/array-bracket-spacing": ["error", "never"],
			"@stylistic/arrow-spacing": ["error", { after: true, before: true }],
			"@stylistic/block-spacing": ["error", "always"],
			"@stylistic/brace-style": ["error", "1tbs"],
			"@stylistic/comma-dangle": ["error", "always-multiline"],
			"@stylistic/comma-spacing": ["error", { after: true, before: false }],
			"@stylistic/comma-style": ["error", "last"],
			"@stylistic/computed-property-spacing": ["error", "never", { enforceForClassMembers: true }],
			"@stylistic/dot-location": ["error", "property"],
			"@stylistic/eol-last": "error",
			"@stylistic/indent": ["error", "tab", {
				SwitchCase: 1,
				flatTernaryExpressions: true,
			}],
			"@stylistic/keyword-spacing": ["error", { after: true, before: true }],
			"@stylistic/linebreak-style": "error",
			"@stylistic/member-delimiter-style": ["error"],
			"@stylistic/new-parens": "error",
			"@stylistic/no-extra-parens": ["error", "functions"],
			"@stylistic/no-floating-decimal": "error",
			"@stylistic/no-mixed-operators": ["error", {
				allowSamePrecedence: true,
				groups: [
					["==", "!=", "===", "!==", ">", ">=", "<", "<="],
					["&&", "||"],
					["in", "instanceof"],
				],
			}],
			"@stylistic/no-mixed-spaces-and-tabs": "error",
			"@stylistic/no-multi-spaces": "error",
			"@stylistic/no-trailing-spaces": "error",
			"@stylistic/no-whitespace-before-property": "error",
			"@stylistic/object-curly-spacing": ["error", "always"],
			"@stylistic/quote-props": ["error", "as-needed"],
			"@stylistic/quotes": ["error", "double", { allowTemplateLiterals: true, avoidEscape: false }],
			"@stylistic/rest-spread-spacing": ["error", "never"],
			"@stylistic/semi": ["error", "always"],
			"@stylistic/semi-spacing": ["error", { after: true, before: false }],
			"@stylistic/space-before-blocks": "error",
			"@stylistic/space-before-function-paren": ["error", { anonymous: "always", asyncArrow: "always", named: "never" }],
			"@stylistic/space-in-parens": ["error", "never"],
			"@stylistic/space-unary-ops": ["error", { nonwords: false, words: true }],
			"@stylistic/template-curly-spacing": "error",
			"@stylistic/template-tag-spacing": ["error", "never"],
			"@stylistic/type-annotation-spacing": ["error", {}],
			"@stylistic/type-generic-spacing": "error",
			"@stylistic/type-named-tuple-spacing": "error",
			"@stylistic/wrap-iife": ["error", "inside", { functionPrototypeMethods: true }],
			"@stylistic/yield-star-spacing": ["error", { before: false, after: true }],
		},
	},
);
