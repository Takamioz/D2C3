class UtilFolders {
	static async pCreateFoldersGetId ({folderType, folderIdRoot = null, folderNames, sorting = null}) {
		folderNames = folderNames.map(it => (typeof it === "string" && !it.trim()) ? " " : it);

		try {
			await this._LOCK_FOLDER_CREATE.pLock();
			const out = await this._pCreateFolders_({folderType, folderIdRoot, folderNames, sorting});
			void out;
			return out;
		} finally {
			this._LOCK_FOLDER_CREATE.unlock();
		}
	}

	static async _pCreateFolders_ ({folderType, folderIdRoot, folderNames, sorting}) {
		if (!folderNames?.length || !folderType) return null;

		const stack = [];
		if (folderIdRoot != null) {
			const folder = CONFIG.Folder.collection.instance.get(folderIdRoot);
			if (folder) stack.push(folder);
		}

		for (let i = 0; i < folderNames.length; ++i) {
			const name = folderNames[i];
			const isLast = i === folderNames.length - 1;

			const parentId = stack.length ? stack.last().id : null;

			const folder = this._pCreateFolders_findFolder({folderType, folderStack: stack, name, parentId});
			if (folder) {
				stack.push(folder);
				continue;
			}

			// create a new folder
			const folderData = {
				name,
				parent: parentId,
				type: folderType,
			};
			if (isLast && sorting) folderData.sorting = sorting;
			const nuFolder = await Folder.create(folderData, {});
			stack.push(nuFolder);
		}

		// Sanity check; should never occur
		if (stack.length) return stack.last().id;
		return null;
	}

	static _pCreateFolders_findFolder ({folderType, folderStack, name, parentId}) {
		const matches = CONFIG.Folder.collection.instance.contents.filter(it => {
			const isNameMatch = it.data.name === `${name}`;
			const isTypeMatch = it.data.type === folderType;
			const isParentMatch = parentId ? it.data.parent === parentId : it.data.parent == null;
			return isNameMatch && isTypeMatch && isParentMatch;
		});

		if (matches.length > 1) {
			const msg = `Ambiguous folder path! Found multiple folders for ${folderStack.map(it => it.data.name).join(" > ")}`;
			ui.notifications.error(msg);
			throw new Error(msg);
		}
		if (matches.length) return matches[0];
		return null;
	}
}
UtilFolders._LOCK_FOLDER_CREATE = new VeLock();

export {UtilFolders};
