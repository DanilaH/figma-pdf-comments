"use strict";
(() => {
  // src/code.ts
  figma.showUI(__html__, { width: 520, height: 620 });
  var busy = false;
  figma.ui.onmessage = async (m) => {
    var _a;
    if ((m == null ? void 0 : m.type) !== "snapshot") return;
    if (typeof m.requestId !== "string" || m.requestId.length > 100) return;
    if (busy) {
      figma.ui.postMessage({ type: "error", requestId: m.requestId, message: "The previous frame export is still running. Wait a moment and retry." });
      return;
    }
    busy = true;
    try {
      figma.ui.postMessage({ type: "progress", requestId: m.requestId, message: "Checking selected frames in Figma\u2026" });
      const nodes = [...figma.currentPage.selection];
      if (nodes.length < 1 || nodes.length > 12) throw Error("Select 1\u201312 top-level frames on the current page.");
      const frames = [];
      for (const [index, node] of nodes.entries()) {
        if (node.type !== "FRAME" || ((_a = node.parent) == null ? void 0 : _a.type) !== "PAGE") throw Error("Only frames directly on the current page are supported.");
        if (!node.visible || !node.clipsContent) throw Error("Frames must be visible and Clip content must be enabled for reliable raster bounds.");
        const [[a, b, x], [c, d, y]] = node.absoluteTransform;
        if (Math.abs(a - 1) > 1e-5 || Math.abs(d - 1) > 1e-5 || Math.abs(b) > 1e-5 || Math.abs(c) > 1e-5) throw Error("Rotated, flipped or transformed frames are not supported in this diagnostic.");
        if (node.effects.some((e) => e.visible !== false)) throw Error("Remove effects from the frame container for this diagnostic (effects inside it are allowed).");
        if (node.width < 1 || node.height < 1 || node.width * node.height > 2e7 || node.height > 2e4) throw Error("A selected frame is too large for this diagnostic.");
        const scale = Math.min(1, 1500 / node.width);
        figma.ui.postMessage({ type: "progress", requestId: m.requestId, message: `Rendering frame ${index + 1}/${nodes.length}: ${node.name} (${Math.round(node.width)} \xD7 ${Math.round(node.height)})\u2026` });
        const png = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale }, contentsOnly: true, useAbsoluteBounds: true });
        frames.push({ id: node.id, name: node.name, x, y, width: node.width, height: node.height, png });
      }
      figma.ui.postMessage({ type: "snapshot", requestId: m.requestId, title: figma.root.name, page: figma.currentPage.name, frames });
    } catch (e) {
      figma.ui.postMessage({ type: "error", requestId: m.requestId, message: e instanceof Error ? e.message : String(e) });
    } finally {
      busy = false;
    }
  };
})();
