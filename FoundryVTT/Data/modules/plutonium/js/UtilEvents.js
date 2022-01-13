import {UtilActors} from "./UtilActors.js";
import {SharedConsts} from "../shared/SharedConsts.js";
import {Config} from "./Config.js";
import {LGT} from "./Util.js";

class UtilEvents {
	static init () {
		this.bindDocumentHandlers();
	}

	static bindDocumentHandlers ({element = document.body} = {}) {
		$(element)
			.on(`click`, `[data-packed-dice]`, function (evt) {
				const $this = $(this);
				// Only do the fake click if the element doesn't already have its click handler.
				//  This is useful for e.g. when the other attributes get stripped before posting to chat.
				if (!$this.attr("onclick")) Renderer.dice.pRollerClickUseData(evt, this);
			})

			// region Hover replacements
			// (Based on `Renderer._renderLink_getHoverString`)
			.on(`mouseover`, `[data-plut-hover]`, function (evt) {
				const isPreload = !!evt.currentTarget.dataset.plutHoverPreload;
				const preloadUid = evt.currentTarget.dataset.plutHoverPreloadUid;
				const page = evt.currentTarget.dataset.plutHoverPage;
				const source = evt.currentTarget.dataset.plutHoverSource;
				let hash = evt.currentTarget.dataset.plutHoverHash;
				const preloadId = evt.currentTarget.dataset.plutHoverPreloadId;
				const hashPreEncoded = !!evt.currentTarget.dataset.plutHoverHashPreEncoded;
				let hashHover = evt.currentTarget.dataset.plutHoverHashHover;
				const hashPreEncodedHover = !!evt.currentTarget.dataset.plutHoverHashPreEncodedHover;
				const subhashesHover = evt.currentTarget.dataset.plutHoverSubhashesHover;

				if (preloadUid) {
					const tag = evt.currentTarget.dataset.plutHoverTag;
					const pipeParts = evt.currentTarget.dataset.plutHoverPipeParts;

					const expander = tag === "skill" ? Parser.skillToExplanation : tag === "sense" ? Parser.senseToExplanation : null;
					if (!expander) return;

					const [name] = Renderer.splitTagByPipe(pipeParts);
					const hoverMeta = Renderer.hover.getMakePredefinedHover(
						{
							type: "entries",
							name: name.toTitleCase(),
							entries: expander(name),
						},
						{
							id: preloadUid,
						},
					);

					hoverMeta.mouseOver(evt, this);

					return;
				}

				if (isPreload) {
					if (preloadId == null) return;
					const preloadOptions = evt.currentTarget.dataset.plutHoverPreloadOptions;
					Renderer.hover.handlePredefinedMouseOver(evt, this, preloadId, preloadOptions ? JSON.parse(preloadOptions) : undefined);
					return;
				}

				if (!page || !source || !hash) return;

				if (!hashPreEncoded) hash = UrlUtil.encodeForHash(hash);
				if (hashHover && !hashPreEncodedHover) hashHover = UrlUtil.encodeForHash(hashHover);
				if (!hashHover) hashHover = hash;

				if (subhashesHover) {
					const parsed = JSON.parse(subhashesHover);
					hashHover += Renderer.utils.getLinkSubhashString(parsed);
				}

				const hoverMeta = {
					page: page,
					source: source,
					hash: hashHover,
					preloadId: preloadId,
					// Delay the appearance of the hover window if the user is pointing at a draggable element
					isDelay: !!evt.currentTarget.dataset.plutRichLink,
				};
				Renderer.hover.pHandleLinkMouseOver(evt, this, hoverMeta).then(null);
			})
			.on(`mouseleave`, `[data-plut-hover]`, function (evt) {
				Renderer.hover.handleLinkMouseLeave(evt, this);
			})
			.on(`mousemove`, `[data-plut-hover]`, function (evt) {
				Renderer.hover.handleLinkMouseMove(evt, this);
			})
			// endregion

			// region Drag-drop of `@<tag>[...]` content
			.on(`dragstart`, `[data-plut-rich-link]`, function (evt) {
				// Based on `TextEditor._onDragEntityLink`

				const entityType = evt.currentTarget.dataset.plutRichLinkEntityType;
				const page = evt.currentTarget.dataset.plutHoverPage;
				const source = evt.currentTarget.dataset.plutHoverSource;
				let hash = evt.currentTarget.dataset.plutHoverHash;
				const hashPreEncoded = !!evt.currentTarget.dataset.plutHoverHashPreEncoded;
				const subhashesHover = evt.currentTarget.dataset.plutHoverSubhashesHover;

				if (!page || !source || !hash || !entityType) return;

				if (!hashPreEncoded) hash = UrlUtil.encodeForHash(hash);

				if (subhashesHover) {
					const parsed = JSON.parse(subhashesHover);
					hash += Renderer.utils.getLinkSubhashString(parsed);
				}

				evt.stopPropagation();
				evt.originalEvent.dataTransfer.setData(
					"text/plain",
					JSON.stringify({
						type: entityType,
						subType: UtilEvents.EVT_DATA_SUBTYPE__HOVER,
						page,
						source,
						hash,
						originalText: evt.currentTarget.dataset.plutRichLinkOriginalText,
					}),
				);
			})
			// endregion

			// region `"@ActorEmbeddedItem[...][...]{...}"` links
			.on(`click`, `[data-plut-owned-link]`, function (evt) {
				const entityType = evt.currentTarget.dataset.parentEntity;
				const ownedItemType = evt.currentTarget.dataset.childEntity; // N.b. currently unused, as we only support items
				const parentId = evt.currentTarget.dataset.parentId;
				const childId = evt.currentTarget.dataset.childId;

				const config = CONFIG[entityType];
				const parentEntity = config.collection.instance.get(parentId);
				if (!parentEntity) {
					const msg = `Could not find ${entityType} "${parentId}"!`;
					console.warn(...LGT, msg);
					return ui.notifications.warn(msg);
				}

				const childEntity = parentEntity.items.get(childId);

				if (Config.get("text", "isAutoRollActorEmbeddedDocumentTags")) {
					childEntity.roll();
					return;
				}

				childEntity.sheet.render(true);
			})
			// endregion

			// region `"@Folder[...]{...}"` links
			.on(`click`, `[data-plut-folder-link]`, async function (evt) {
				const folderId = evt.currentTarget.dataset.entityId;
				const folderEntity = CONFIG.Folder.collection.instance.get(folderId);
				if (!folderEntity) return;

				const sidebarTabName = CONFIG[folderEntity.type]?.documentClass?.metadata?.collection;
				if (!sidebarTabName) return;
				await ui.sidebar.activateTab(sidebarTabName);

				const sidebarTab = ui.sidebar.tabs[sidebarTabName];
				const $eleFolder = sidebarTab.element.find(`[data-folder-id="${folderEntity.id}"]`);

				if (!folderEntity.expanded) {
					// region Based on `SidebarDirectory._toggleFolder`
					game.folders._expanded[folderEntity.id] = true;

					$eleFolder.removeClass("collapsed");

					// Resize container
					if (sidebarTab.popOut) this.setPosition();
					// endregion
				}

				$eleFolder[0].scrollIntoView({block: "center"});

				// Briefly make the folder glow
				$eleFolder.addClass("jlnk__folder-pulse-1s");
				setTimeout(() => $eleFolder.removeClass("jlnk__folder-pulse-1s"), 1000);
			})
			// endregion
		;

		Renderer.events.bindGeneric({element});

		UtilEvents._ADDITIONAL_DOCUMENT_HANDLERS.forEach(({eventType, selector, fnEvent}) => this._doBindHandler({element, eventType, selector, fnEvent}));

		UtilEvents._BOUND_DOCUMENT_ELEMENTS.add(element);
	}

	static registerDocumentHandler ({eventType, selector, fnEvent}) {
		UtilEvents._ADDITIONAL_DOCUMENT_HANDLERS.push({eventType, selector, fnEvent});
		UtilEvents._BOUND_DOCUMENT_ELEMENTS.forEach(element => this._doBindHandler({element, eventType, selector, fnEvent}));
	}

	static _doBindHandler ({element, eventType, selector, fnEvent}) {
		$(element).on(eventType, selector, fnEvent);
	}

	static unbindDocumentHandlers ({element = document.body} = {}) {
		// N.b. actual unbinding unimplemented; we assume that this is called if the window is closing
		UtilEvents._BOUND_DOCUMENT_ELEMENTS.delete(element);
	}

	static getDropJson (evt) {
		let data;
		for (const mimeType of UtilEvents._MIME_TYPES_DROP_JSON) {
			if (!evt.dataTransfer.types.includes(mimeType)) continue;

			try {
				const rawJson = evt.dataTransfer.getData(mimeType);
				if (!rawJson) return;
				data = JSON.parse(rawJson);
			} catch (e) {
				// Do nothing
			}
		}
		return data;
	}
}
UtilEvents._MIME_TYPES_DROP_JSON = ["application/json", "text/plain"]; // In order of preference/priority
UtilEvents.EVT_DATA_SUBTYPE__HOVER = `${SharedConsts.MODULE_NAME_FAKE}.Hover`;

UtilEvents._BOUND_DOCUMENT_ELEMENTS = new Set();
UtilEvents._ADDITIONAL_DOCUMENT_HANDLERS = [];

export {UtilEvents};
