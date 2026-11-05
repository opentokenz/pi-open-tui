import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { hostname as osHostname } from "node:os";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { OpenTuiConfig } from "./config.ts";
import type { IconGlyphs } from "./icons.ts";
import { resolveGlyphs, resolveIconMode, runtimeSymbol } from "./icons.ts";
import type { GitStatus } from "./git.ts";
import type { RuntimeInfo } from "./runtime.ts";
import type { LiveTps } from "./telemetry.ts";
import {
	alignRight,
	basenamePath,
	cacheHitColor,
	effortColor,
	fitSegmentsByPriority,
	fmtTokens,
	formatCwd,
	formatDuration,
	formatInputBreakdown,
	hasAnsiStyles,
	providerColor,
	sanitizeStatusPreservingStyles,
	stressColor,
	truncateBranch,
	truncatePath,
	type PrioritizedSegment,
} from "./utils.ts";
import type { FooterState, ModelMeta, UsageTotals } from "./state.ts";
import { getUsageTotals } from "./state.ts";

export function shortHostname(hostname: string): string {
	return hostname.split(".")[0] ?? "";
}

// Kitty can use the blank cell after a wide Nerd icon to render the glyph.
// With footerSegments.nerdIconSpacing, reserve an extra cell before fitting
// footer segments. Keep Unicode/ASCII and Git flags compact.
function spaceFooterIcon(glyph: string): string {
	return /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u.test(glyph)
		? `${glyph} `
		: glyph;
}

function renderBar(theme: Theme, pct: number, barWidth: number, ascii: boolean): string {
	const filled = Math.max(0, Math.min(barWidth, Math.round((pct / 100) * barWidth)));
	const empty = barWidth - filled;
	const color = stressColor(pct);
	const filledCell = ascii ? "#" : "█";
	const emptyCell = ascii ? "-" : "░";
	return (
		theme.fg("dim", "[") +
		theme.fg(color, filledCell.repeat(filled)) +
		theme.fg("dim", emptyCell.repeat(empty)) +
		theme.fg("dim", "]")
	);
}

interface ContextUsage {
	tokens: number;
	window: number;
	percent: number;
}

function readContextUsage(ctx: ExtensionContext): ContextUsage {
	const usage = ctx.getContextUsage();
	return {
		tokens: usage?.tokens ?? 0,
		window: usage?.contextWindow ?? ctx.model?.contextWindow ?? 0,
		percent: usage?.percent ?? 0,
	};
}

/** Compact context form: icon + percentage, no bar or token counts. */
function renderContextCompact(theme: Theme, ctx: ExtensionContext, glyphs: IconGlyphs): string {
	const { window, percent } = readContextUsage(ctx);
	if (window <= 0) return "";
	return `${theme.fg(stressColor(percent), glyphs.context)} ${theme.fg(stressColor(percent), `${percent.toFixed(1)}%`)}`;
}

function renderGitSegment(
	theme: Theme,
	git: GitStatus,
	glyphs: IconGlyphs,
	segments: OpenTuiConfig["footerSegments"],
	maxBranchLen = 20,
): string {
	const parts: string[] = [];
	if (segments.gitBranch) {
		if (git.branch) {
			parts.push(theme.fg("mdLink", glyphs.git));
			parts.push(theme.fg("mdLink", truncateBranch(git.branch, maxBranchLen)));
		} else if (git.commit?.detached) {
			parts.push(theme.fg("warning", glyphs.git));
			parts.push(theme.fg("warning", "HEAD"));
			if (git.commit.oid) {
				const shortHash = git.commit.oid.slice(0, 7);
				const tag = git.commit.tag ? ` ${git.commit.tag}` : "";
				parts.push(theme.fg("dim", `${shortHash}${tag}`));
			}
		}
	}

	if (segments.gitStatus) {
		const statusIcons: string[] = [];
		// ponytail: always show count — `!1` not `!`, so 1 vs 100 is distinguishable.
		const addStatus = (count: number, glyph: string, color: ThemeColor) => {
			if (count > 0) statusIcons.push(theme.fg(color, `${glyph}${count}`));
		};
		addStatus(git.conflicted, glyphs.conflicted, "error");
		addStatus(git.deleted, glyphs.deleted, "error");
		addStatus(git.modified, glyphs.modified, "warning");
		addStatus(git.renamed, glyphs.renamed, "warning");
		addStatus(git.staged, glyphs.staged, "success");
		addStatus(git.untracked, glyphs.untracked, "muted");
		addStatus(git.stashed, glyphs.stashed, "muted");

		if (git.ahead > 0 && git.behind > 0) {
			statusIcons.push(theme.fg("warning", `${glyphs.diverged}${git.ahead}/${git.behind}`));
		} else if (git.ahead > 0) {
			statusIcons.push(theme.fg("success", `${glyphs.ahead}${git.ahead}`));
		} else if (git.behind > 0) {
			statusIcons.push(theme.fg("warning", `${glyphs.behind}${git.behind}`));
		}

		const statusBlock = statusIcons.join(" ");
		if (statusBlock) {
			parts.push(`${theme.fg("dim", "[")}${statusBlock}${theme.fg("dim", "]")}`);
		}
	}

	return parts.join(" ");
}

function renderRuntimeSegment(
	theme: Theme,
	runtime: RuntimeInfo | null,
	iconMode: OpenTuiConfig["icons"]["mode"],
	spaceIcon: boolean,
): string {
	if (!runtime) return "";
	const glyph = runtimeSymbol(runtime.name, iconMode);
	const symbol = theme.fg("success", spaceIcon ? spaceFooterIcon(glyph) : glyph);
	const version = runtime.version ? theme.fg("muted", runtime.version) : "";
	const label = [symbol, version].filter(Boolean).join(" ");
	return label;
}

function renderTimerSegment(theme: Theme, state: FooterState, glyphs: IconGlyphs): string {
	if (state.workingSince !== undefined) {
		return `${theme.fg("accent", glyphs.working)} ${theme.fg("accent", formatDuration(Date.now() - state.workingSince))}`;
	}
	if (state.lastDoneIn !== undefined) {
		return `${theme.fg("success", glyphs.done)} ${theme.fg("success", "done")} ${theme.fg("text", formatDuration(state.lastDoneIn))}`;
	}
	return "";
}

function renderContextBar(
	theme: Theme,
	ctx: ExtensionContext,
	width: number,
	glyphs: IconGlyphs,
	iconMode: OpenTuiConfig["icons"]["mode"],
): string {
	const { window, percent } = readContextUsage(ctx);

	// ponytail: render 0% bar once we know the window — keeps the right side
	// populated instead of collapsing everything left in an empty session.
	if (window <= 0) return "";

	const pctText = theme.fg(stressColor(percent), `${percent.toFixed(1)}%`);
	const contextIcon = theme.fg(stressColor(percent), glyphs.context);
	// Cap the bar at `width - reserved` (with a floor of 4) so the bar form
	// never forces the left segments out before compact/drop logic kicks in.
	const reserved = visibleWidth(contextIcon) + visibleWidth(pctText) + 4;
	const barWidth = Math.max(4, Math.min(12, width - reserved));
	return `${contextIcon} ${renderBar(theme, percent, barWidth, resolveIconMode(iconMode) === "ascii")} ${pctText}`;
}

/** Numbers form: percentage plus the tokens in use against the window. */
function renderContextNumbers(theme: Theme, ctx: ExtensionContext): string {
	const { tokens, window, percent } = readContextUsage(ctx);
	if (window <= 0) return "";
	const pctText = theme.fg(stressColor(percent), `${percent.toFixed(1)}%`);
	const tokensText = `${theme.fg("text", fmtTokens(tokens))}${theme.fg("dim", "/")}${theme.fg("text", fmtTokens(window))}`;
	return `${pctText} ${theme.fg("dim", "·")} ${tokensText}`;
}

// Priorities on the model row decide what the row gives up first, not where a
// part sits: the model name and the thinking level outrank every other part, so
// a narrow row sheds the icon, the provider, and finally the statistics before
// it shortens either of them.
const MODEL_NAME_PRIORITY = 100;
const MODEL_EFFORT_PRIORITY = 90;
const MODEL_PROVIDER_PRIORITY = 1;
const MODEL_ICON_PRIORITY = 0;
const MODEL_CORE_PRIORITY = MODEL_EFFORT_PRIORITY;
const MODEL_SEPARATOR = " · ";
const STATS_SEPARATOR = " | ";

function joinSegments(
	parts: readonly PrioritizedSegment[],
	separator: string,
	theme: Theme,
): string {
	return parts
		.filter((part) => part.text !== "")
		.map((part) => part.text)
		.join(theme.fg("dim", separator));
}

function renderStatsSegments(
	theme: Theme,
	totals: UsageTotals,
	glyphs: IconGlyphs,
	segments: OpenTuiConfig["footerSegments"],
): PrioritizedSegment[] {
	// Lower priority yields first: cache hit, output, cost, then input.
	const stats: PrioritizedSegment[] = [];
	if (segments.tokens) {
		stats.push({
			text: theme.fg("accent", `${glyphs.input} ${formatInputBreakdown(totals.input, totals.cacheRead)}`),
			priority: 5,
		});
		stats.push({ text: theme.fg("success", `${glyphs.output} ${fmtTokens(totals.output)}`), priority: 3 });
		// ponytail: hide cache-hit rate when the provider never reported cache
		// tokens — avoids a misleading "0%" on providers without prompt caching.
		const hasCacheTokens = totals.cacheRead > 0 || totals.cacheWrite > 0;
		if (hasCacheTokens && totals.latestCacheHitRate !== undefined) {
			stats.push({
				text: theme.fg(cacheHitColor(totals.latestCacheHitRate), `${glyphs.cacheHit} ${totals.latestCacheHitRate.toFixed(1)}%`),
				priority: 2,
			});
		}
	}
	if (segments.cost) {
		stats.push({ text: theme.fg("warning", `${glyphs.cost} $${totals.cost.toFixed(3)}`), priority: 4 });
	}

	return stats;
}

const ANSI_RESET = "\x1b[0m";

/**
 * Keep the colours an extension applied to its own status text. Plain text stays
 * muted so unstyled statuses keep the quiet footer look. The trailing reset
 * stops an unclosed style from tinting the separator and the next status.
 */
function renderStatusText(theme: Theme, status: string): string {
	if (!hasAnsiStyles(status)) return theme.fg("muted", status);
	return `${status}${ANSI_RESET}`;
}

function renderExtensionStatusLines(
	theme: Theme,
	extensionStatuses: ReadonlyMap<string, string>,
	glyphs: IconGlyphs,
	width: number,
): string[] {
	const statuses = Array.from(extensionStatuses.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, text]) => sanitizeStatusPreservingStyles(text))
		.filter((text) => text.length > 0);
	if (statuses.length === 0) return [];

	const separator = ` ${theme.fg("dim", "|")} `;
	const statusText = statuses.map((status) => renderStatusText(theme, status)).join(separator);
	const line = `${theme.fg("mdLink", glyphs.extensions)} ${statusText}`;
	return wrapTextWithAnsi(line, width);
}

export interface FooterHooks {
	setRequestRender: (fn: (() => void) | undefined) => void;
	scheduleGitRefresh: () => void;
	getLiveTps?: () => LiveTps | null;
	canEmbedInEditor?: () => boolean;
}

interface FooterDataLike {
	getExtensionStatuses(): ReadonlyMap<string, string>;
}

export interface InlineFooterLine {
	left: string;
	right: string;
}

export interface InlineFooterLines {
	top: InlineFooterLine;
	bottom: InlineFooterLine;
}

/**
 * Fit the bottom row around the model name and the thinking level: parts are
 * dropped from the cheapest end (icon, provider, cache hit, output, cost, input)
 * until the row fits, so the statistics yield space before either of them
 * shortens. Only a row too narrow for the name and the level themselves drops
 * the level first and then truncates the name.
 *
 * The model parts arrive in display order; their priorities only decide the drop
 * order, never the position.
 */
function fitInlineModelLine(
	modelParts: readonly PrioritizedSegment[],
	statsParts: readonly PrioritizedSegment[],
	width: number,
	theme: Theme,
): InlineFooterLine {
	const core = modelParts.filter((part) => part.priority >= MODEL_CORE_PRIORITY);
	let keptModel = [...modelParts];
	let keptStats = [...statsParts];
	const rowWidth = () => {
		const statsWidth = keptStats.length > 0
			? 1 + visibleWidth(joinSegments(keptStats, STATS_SEPARATOR, theme))
			: 0;
		return visibleWidth(joinSegments(keptModel, MODEL_SEPARATOR, theme)) + statsWidth;
	};

	while (rowWidth() > width) {
		const optional = [
			...keptModel.filter((part) => part.priority < MODEL_CORE_PRIORITY),
			...keptStats,
		];
		if (optional.length === 0) break;
		const victim = optional.reduce((worst, part) => (part.priority < worst.priority ? part : worst));
		if (keptModel.includes(victim)) {
			keptModel = keptModel.filter((part) => part !== victim);
		} else {
			keptStats = keptStats.filter((part) => part !== victim);
		}
	}

	const right = joinSegments(keptStats, STATS_SEPARATOR, theme);
	if (rowWidth() <= width) {
		return { left: joinSegments(keptModel, MODEL_SEPARATOR, theme), right };
	}
	const leftBudget = Math.max(0, width - visibleWidth(right) - (right ? 1 : 0));
	// The thinking level is dropped whole: a truncated "~..." reads as noise.
	const wholeCore = visibleWidth(joinSegments(core, MODEL_SEPARATOR, theme)) <= leftBudget;
	const fitted = wholeCore ? core : core.filter((part) => part.priority >= MODEL_NAME_PRIORITY);
	return { left: fitInlineSegments(fitted, leftBudget, theme), right };
}

export interface FooterHandle {
	renderInline(width: number): InlineFooterLines | undefined;
	cleanup(): void;
}

function fitInlineSegments(
	parts: readonly PrioritizedSegment[],
	width: number,
	theme: Theme,
	separator = MODEL_SEPARATOR,
): string {
	const painted = theme.fg("dim", separator);
	const separatorReserve = Math.max(0, parts.length - 1) * Math.max(0, visibleWidth(painted) - 1);
	return fitSegmentsByPriority(
		parts,
		Math.max(0, width - separatorReserve),
		theme.fg("dim", "..."),
	).filter(Boolean).join(painted);
}

function renderFooterContent(
	ctx: ExtensionContext,
	getState: () => FooterState,
	getConfig: () => OpenTuiConfig,
	getModelMeta: () => ModelMeta,
	theme: Theme,
	footerData: FooterDataLike,
	width: number,
	getLiveTps: () => LiveTps | null,
): { mainLines: [string, string]; inlineLines: InlineFooterLines; extensionLines: string[] } {
	if (width <= 0) {
		return {
			mainLines: ["", ""],
			inlineLines: {
				top: { left: "", right: "" },
				bottom: { left: "", right: "" },
			},
			extensionLines: [],
		};
	}

	const state = getState();
	const config = getConfig();
	const segments = config.footerSegments;
	const glyphs = { ...resolveGlyphs(config.icons.mode) };
	if (segments.nerdIconSpacing) {
		for (const key of Object.keys(glyphs) as (keyof IconGlyphs)[]) {
			glyphs[key] = spaceFooterIcon(glyphs[key]);
		}
	}
	const meta = getModelMeta();
	const totals = getUsageTotals(ctx);

	const leftParts: PrioritizedSegment[] = [];
	const inlineTopLeftParts: PrioritizedSegment[] = [];
	const inlineTopRightParts: PrioritizedSegment[] = [];
	if (segments.cwd) {
		const maxCwd = Math.min(30, Math.max(10, Math.floor(width * 0.4)));
		const cwd = formatCwd(ctx.sessionManager.getCwd());
		const cwdPrefix = `${theme.fg("mdLink", glyphs.cwd)} `;
		const accent = (text: string) => theme.fg("accent", text);
		leftParts.push({
			text: `${cwdPrefix}${accent(truncatePath(cwd, maxCwd))}`,
			compactText: `${cwdPrefix}${accent(truncatePath(basenamePath(cwd), maxCwd))}`,
			priority: 4,
			truncate: (_text, maxWidth, ellipsis) => {
				const pathWidth = maxWidth - visibleWidth(cwdPrefix);
				if (pathWidth <= visibleWidth(ellipsis)) {
					return truncateToWidth(`${cwdPrefix}${accent(basenamePath(cwd))}`, maxWidth, ellipsis);
				}
				return `${cwdPrefix}${accent(truncatePath(basenamePath(cwd), pathWidth))}`;
			},
		});
		inlineTopRightParts.push(leftParts.at(-1)!);
	}
	if (segments.hostname) {
		const shortHost = shortHostname(osHostname());
		if (shortHost) {
			leftParts.push({
				text: `${theme.fg("dim", glyphs.host)} ${theme.fg("accent", shortHost)}`,
				priority: 3,
			});
			inlineTopRightParts.push(leftParts.at(-1)!);
		}
	}
	const sessionName = ctx.sessionManager.getSessionName();
	if (sessionName) {
		const sessionPart: PrioritizedSegment = {
			text: `${theme.fg("dim", glyphs.session)} ${theme.fg("text", truncateToWidth(sessionName, 24, theme.fg("dim", "...")))}`,
			priority: 2,
		};
		if (segments.sessionName) {
			leftParts.push(sessionPart);
			inlineTopLeftParts.push(sessionPart);
		}
	}
	const gitSeg = renderGitSegment(theme, state.git, glyphs, segments);
	if (gitSeg) {
		leftParts.push({ text: gitSeg, priority: 1 });
		inlineTopLeftParts.push(leftParts.at(-1)!);
	}
	if (segments.runtime) {
		const runtimeSeg = renderRuntimeSegment(theme, state.runtime, config.icons.mode, segments.nerdIconSpacing);
		if (runtimeSeg) {
			leftParts.push({ text: runtimeSeg, priority: 0 });
			inlineTopRightParts.push(leftParts.at(-1)!);
		}
	}
	const timerSeg = renderTimerSegment(theme, state, glyphs);
	if (timerSeg) {
		const liveTps = state.workingSince !== undefined && segments.liveTps
			? getLiveTps()
			: null;
		const text = liveTps === null
			? timerSeg
			: `${timerSeg} ${theme.fg("dim", "·")} ${theme.fg(liveTps.stale ? "dim" : "accent", `${glyphs.speed} ~${Math.round(liveTps.tps)} tok/s`)}`;
		// Narrow widths shed the live TPS before the timer itself.
		leftParts.push({ text, compactText: liveTps === null ? undefined : timerSeg, priority: 3 });
		inlineTopRightParts.push(leftParts.at(-1)!);
	}

	// The context bar competes with the left segments for the same row:
	// full bar first, then the compact icon+pct form, then dropped.
	let contextText = "";
	let contextCompact: string | undefined;
	if (segments.context) {
		contextText = config.contextStyle === "numbers"
			? renderContextNumbers(theme, ctx)
			: renderContextBar(theme, ctx, width, glyphs, config.icons.mode);
		const compact = renderContextCompact(theme, ctx, glyphs);
		if (compact && visibleWidth(compact) < visibleWidth(contextText)) {
			contextCompact = compact;
		}
	}
	const allParts: PrioritizedSegment[] = [...leftParts];
	if (contextText) {
		// Context sheds with runtime, before git/session/host/timer/cwd.
		allParts.push({ text: contextText, compactText: contextCompact, priority: 0 });
		// Context stays at the far right; cwd is the first item in this group.
		inlineTopRightParts.push({ text: contextText, compactText: contextCompact, priority: 0 });
	}

	const fitted = fitSegmentsByPriority(allParts, width, theme.fg("dim", "..."));
	const fittedContext = contextText ? fitted.pop() ?? "" : "";
	const line1 = alignRight(fitted.filter(Boolean).join(" "), fittedContext, width, theme);

	const inlineLeftBudget = Math.floor(width * 0.45);
	const inlineTopLeft = fitInlineSegments(inlineTopLeftParts, inlineLeftBudget, theme);
	const inlineRightBudget = Math.max(0, width - visibleWidth(inlineTopLeft) - (inlineTopLeft ? 1 : 0));
	const inlineTop: InlineFooterLine = {
		left: inlineTopLeft,
		right: fitInlineSegments(inlineTopRightParts, inlineRightBudget, theme),
	};

	// The model name leads the row; the icon trails it because it only helps
	// once the reader already knows which slot the row belongs to.
	const modelSegments: PrioritizedSegment[] = [
		{ text: theme.fg("text", meta.model), priority: MODEL_NAME_PRIORITY },
	];
	if (meta.effort && meta.effort !== "off") {
		modelSegments.push({
			text: theme.fg(effortColor(meta.effort), `${glyphs.thinking} ${meta.effort}`),
			priority: MODEL_EFFORT_PRIORITY,
		});
	}
	if (meta.provider && meta.provider !== "Unknown") {
		modelSegments.push({
			text: theme.fg(providerColor(ctx.model?.provider ?? "none"), meta.provider),
			priority: MODEL_PROVIDER_PRIORITY,
		});
	}
	modelSegments.push({ text: theme.fg("mdLink", glyphs.model), priority: MODEL_ICON_PRIORITY });
	const inlineBottom = fitInlineModelLine(
		modelSegments,
		renderStatsSegments(theme, totals, glyphs, segments),
		width,
		theme,
	);
	const line2 = alignRight(inlineBottom.left, inlineBottom.right, width, theme);
	const mainLines: [string, string] = [line1, line2]
		.map((line) => truncateToWidth(line, width, theme.fg("dim", "..."))) as [string, string];
	const extensionLines = segments.extensionStatuses
		? renderExtensionStatusLines(theme, footerData.getExtensionStatuses(), glyphs, width)
		: [];
	return { mainLines, inlineLines: { top: inlineTop, bottom: inlineBottom }, extensionLines };
}

export function installFooter(
	ctx: ExtensionContext,
	getState: () => FooterState,
	getConfig: () => OpenTuiConfig,
	getModelMeta: () => ModelMeta,
	hooks: FooterHooks,
): FooterHandle {
	let renderInline: (width: number) => InlineFooterLines | undefined = () => undefined;

	ctx.ui.setFooter((tui, theme, footerData) => {
		hooks.setRequestRender(() => tui.requestRender());
		const unsubBranch = footerData.onBranchChange(() => {
			hooks.scheduleGitRefresh();
			tui.requestRender();
		});
		const getContent = (width: number) => renderFooterContent(
			ctx,
			getState,
			getConfig,
			getModelMeta,
			theme,
			footerData,
			width,
			hooks.getLiveTps ?? (() => null),
		);

		renderInline = (width) => getContent(width).inlineLines;

		return {
			dispose() {
				unsubBranch();
				hooks.setRequestRender(undefined);
				renderInline = () => undefined;
			},
			invalidate() {},
			render(width: number): string[] {
				if (width <= 0) return [""];
				const { mainLines, extensionLines } = getContent(width);
				const inline = getConfig().inlineFooter && (hooks.canEmbedInEditor?.() ?? true);
				return inline ? extensionLines : [...mainLines, ...extensionLines];
			},
		};
	});

	return {
		renderInline: (width) => renderInline(width),
		cleanup() {
			ctx.ui.setFooter(undefined);
		},
	};
}
