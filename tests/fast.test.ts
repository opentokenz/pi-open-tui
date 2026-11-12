import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	getFastState,
	injectPriority,
	matchesModelPattern,
	validateModelPatterns,
} from "../extensions/open-tui/fast.ts";
import openTui from "../extensions/open-tui/index.ts";
import { preserveEnvironment, temporaryDirectory } from "./fixtures/test-helpers.ts";

const model = { provider: "provider-a", id: "gpt-6-luna" };

// Model rules.
test("exact model rules match only the complete, case-sensitive provider/model key", () => {
	const rules = ["provider-a/gpt-6-luna"];

	assert.equal(matchesModelPattern("provider-a", "gpt-6-luna", rules), true);
	assert.equal(matchesModelPattern("other", "gpt-6-luna", rules), false);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-sol", rules), false);
	assert.equal(matchesModelPattern("provider-a", "GPT-6-luna", rules), false);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-luna-preview", rules), false);
});

test("asterisks match zero or more characters within one provider or model component", () => {
	assert.equal(matchesModelPattern("provider-a", "gpt-6-sol", ["provider-a/gpt-6-*"]), true);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-", ["provider-a/gpt-6-*"]), true);
	assert.equal(matchesModelPattern("other", "gpt-6-sol", ["provider-a/gpt-6-*"]), false);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-sol", ["*/gpt-6-sol"]), true);
	assert.equal(matchesModelPattern("other", "gpt-6-sol", ["*/gpt-6-sol"]), true);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-sol/extra", ["*/gpt-6-*"]), false);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-luna", ["provider-a/*-luna"]), true);
	assert.equal(matchesModelPattern("provider-a", "gpt-6-sol", ["provider-a/*-luna"]), false);
});

test("model IDs may contain slash-separated components without letting wildcards cross them", () => {
	const nestedRule = "gateway/team/gpt-*";

	assert.deepEqual(validateModelPatterns([nestedRule]), { valid: [nestedRule], invalid: [] });
	assert.equal(matchesModelPattern("gateway", "team/gpt-6-luna", [nestedRule]), true);
	assert.equal(matchesModelPattern("other", "team/gpt-6-luna", [nestedRule]), false);
	assert.equal(matchesModelPattern("gateway", "team/gpt-6-luna", ["*/gpt-*"]), false);
	assert.equal(matchesModelPattern("gateway", "team/gpt-6-luna", ["gateway/team/*"]), true);
	assert.equal(matchesModelPattern("gateway", "team/gpt-6-luna", ["gateway/team*"]), false);
});

test("invalid rules are reported and never match", () => {
	const invalidRules = ["missing-separator", "/gpt-6-luna", "provider-a/", "provider-a/gpt//extra", "provider-a/gpt-?"];

	assert.deepEqual(validateModelPatterns(invalidRules), { valid: [], invalid: invalidRules });
	assert.equal(matchesModelPattern("provider-a", "gpt-6-luna", invalidRules), false);
});

// Fast state.
test("effective state requires both a requested toggle and a matching model", () => {
	assert.deepEqual(getFastState(false, model, ["provider-a/gpt-6-*"]), {
		requested: false,
		supported: true,
		effective: false,
	});
	assert.deepEqual(getFastState(true, model, ["provider-a/gpt-6-*"]), {
		requested: true,
		supported: true,
		effective: true,
	});
	assert.deepEqual(getFastState(true, model, ["other/gpt-6-*"]), {
		requested: true,
		supported: false,
		effective: false,
	});
});

test("unsupported models keep the requested state, so switching models can activate Fast", () => {
	const unsupported = getFastState(true, model, ["other/gpt-6-*"]);
	const supportedAfterModelChange = getFastState(unsupported.requested, model, ["provider-a/gpt-6-*"]);

	assert.equal(unsupported.requested, true);
	assert.equal(unsupported.effective, false);
	assert.equal(supportedAfterModelChange.effective, true);
});

// Request payload.
test("priority is added only when Fast is requested and the complete model key matches", () => {
	const original = { model: "gpt-6-luna", messages: [{ role: "user", content: "hello" }] };
	const injected = injectPriority(original, true, model, ["provider-a/gpt-6-*"]) as Record<string, unknown>;

	assert.equal(injected.service_tier, "priority");
	assert.deepEqual(injected.model, original.model);
	assert.deepEqual(injected.messages, original.messages);
	assert.equal("service_tier" in original, false);
	assert.equal(injectPriority(original, false, model, ["provider-a/gpt-6-*"]), original);
	assert.equal(injectPriority(original, true, model, ["other/gpt-6-*"]), original);
});

test("an existing service tier is replaced only for an active matching request", () => {
	const original = { service_tier: "default", input: "hello" };

	assert.deepEqual(injectPriority(original, true, model, ["provider-a/gpt-6-luna"]), {
		service_tier: "priority",
		input: "hello",
	});
	assert.equal(original.service_tier, "default");
});

test("inactive, unsupported, or malformed payloads are returned unchanged", () => {
	const arrayPayload: unknown[] = [];
	const objectPayload = { input: "hello" };

	assert.equal(injectPriority(arrayPayload, true, model, ["provider-a/gpt-6-luna"]), arrayPayload);
	assert.equal(injectPriority("not-an-object", true, model, ["provider-a/gpt-6-luna"]), "not-an-object");
	assert.equal(injectPriority(null, true, model, ["provider-a/gpt-6-luna"]), null);
	assert.equal(injectPriority(objectPayload, true, undefined, ["provider-a/gpt-6-luna"]), objectPayload);
});

// Extension wiring: /fast toggles the payload and the footer marker.
function fastHost(options: { model?: { provider: string; id: string } } = {}) {
	const commands = new Map<string, { handler: (args: string, ctx: ExtensionContext) => unknown }>();
	const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => unknown>();
	const notifications: Array<{ message: string; level?: string }> = [];
	const pi = {
		on(name: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) {
			handlers.set(name, handler);
			return () => handlers.delete(name);
		},
		registerCommand(name: string, command: { handler: (args: string, ctx: ExtensionContext) => unknown }) {
			commands.set(name, command);
		},
		registerMarkdownTransformer() {},
		registerToolRenderer() {},
		events: { on() { return () => {}; }, emit() {} },
	} as unknown as ExtensionAPI;
	const ctx = {
		hasUI: false,
		mode: "cli",
		cwd: "/work/project",
		model: options.model ?? { provider: "openai", id: "gpt-5.4" },
		ui: {
			notify(message: string, level?: string) {
				notifications.push({ message, level });
			},
		},
	} as unknown as ExtensionContext;
	openTui(pi);
	return { commands, handlers, notifications, ctx };
}

test("fast extension hook injects priority only for configured models", async (t) => {
	// loadConfig reads and writes open-tui.json inside the agent directory.
	preserveEnvironment(t, ["PI_CODING_AGENT_DIR"]);
	process.env.PI_CODING_AGENT_DIR = temporaryDirectory(t, "open-tui-fast-agent-");

	const { commands, handlers, notifications, ctx } = fastHost();
	await handlers.get("session_start")!({}, ctx);
	const request = (payload: unknown) => handlers.get("before_provider_request")!({ payload }, ctx);

	assert.equal(request({ input: "hello" }), undefined, "Fast starts off");
	await commands.get("fast")!.handler("", ctx);
	assert.deepEqual(request({ input: "hello" }), { input: "hello", service_tier: "priority" });
	assert.deepEqual(notifications.at(-1), { message: "Fast on.", level: "info" });

	const unsupported = fastHost({ model: { provider: "relay", id: "gpt-5.4" } });
	await unsupported.handlers.get("session_start")!({}, unsupported.ctx);
	await unsupported.commands.get("fast")!.handler("", unsupported.ctx);
	const payload = { input: "hello" };
	assert.equal(unsupported.handlers.get("before_provider_request")!({ payload }, unsupported.ctx), undefined);
	assert.match(String(unsupported.notifications.at(-1)?.message), /not listed in fast\.supportedModels/);
	assert.equal(unsupported.notifications.at(-1)?.level, "warning");
});
