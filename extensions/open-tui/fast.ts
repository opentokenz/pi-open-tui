export interface FastModelIdentity {
	provider: string;
	id: string;
}

export interface FastState {
	requested: boolean;
	supported: boolean;
	effective: boolean;
}

export interface ValidatedModelPatterns {
	valid: string[];
	invalid: string[];
}

interface ParsedModelPattern {
	provider: string;
	modelParts: string[];
}

function isValidComponent(component: string): boolean {
	return component.length > 0 && !/[?\[\]{}\\]/.test(component);
}

function parseModelPattern(pattern: string): ParsedModelPattern | undefined {
	const separator = pattern.indexOf("/");
	if (separator <= 0) return undefined;

	const provider = pattern.slice(0, separator);
	const modelParts = pattern.slice(separator + 1).split("/");
	if (!isValidComponent(provider) || !modelParts.every(isValidComponent)) return undefined;
	return { provider, modelParts };
}

export function validateModelPatterns(patterns: readonly string[]): ValidatedModelPatterns {
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const pattern of patterns) {
		if (parseModelPattern(pattern)) valid.push(pattern);
		else invalid.push(pattern);
	}

	return { valid, invalid };
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesComponent(pattern: string, value: string): boolean {
	if (!pattern.includes("*")) return pattern === value;
	const expression = new RegExp(`^${pattern.split("*").map(escapeRegExp).join("[^/]*")}$`);
	return expression.test(value);
}

export function matchesModelPattern(provider: string, modelId: string, patterns: readonly string[]): boolean {
	if (!provider || provider.includes("/") || !modelId) return false;
	const modelParts = modelId.split("/");
	if (modelParts.some((part) => part.length === 0)) return false;

	return patterns.some((pattern) => {
		const parsed = parseModelPattern(pattern);
		if (!parsed || parsed.modelParts.length !== modelParts.length) return false;
		return matchesComponent(parsed.provider, provider)
			&& parsed.modelParts.every((part, index) => matchesComponent(part, modelParts[index]!));
	});
}

export function getFastState(
	requested: boolean,
	model: FastModelIdentity | undefined,
	supportedModels: readonly string[],
): FastState {
	// An unsupported model keeps `requested` on, so switching to a configured
	// model can make Fast effective without pressing `/fast` again.
	const supported = model !== undefined && matchesModelPattern(model.provider, model.id, supportedModels);
	return { requested, supported, effective: requested && supported };
}

function isPlainRecord(payload: unknown): payload is Record<string, unknown> {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
	const prototype = Object.getPrototypeOf(payload);
	return prototype === Object.prototype || prototype === null;
}

/** Adds `service_tier: "priority"` only for an effective Fast state; every other payload is returned untouched. */
export function injectPriority(
	payload: unknown,
	requested: boolean,
	model: FastModelIdentity | undefined,
	supportedModels: readonly string[],
): unknown {
	if (!getFastState(requested, model, supportedModels).effective || !isPlainRecord(payload)) return payload;
	return { ...payload, service_tier: "priority" };
}
