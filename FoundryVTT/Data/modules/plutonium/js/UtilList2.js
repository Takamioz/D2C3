class UtilList2 {
	static absorbFnGetData (li) {
		const cbSel = li.ele.firstElementChild?.firstElementChild?.firstElementChild?.tagName === "INPUT"
			? li.ele.firstElementChild.firstElementChild.firstElementChild
			: li.ele.querySelector(`input[type="checkbox"], input[type="radio"]`);

		const btnShowHidePreview = li.ele.firstElementChild?.children?.[1]?.firstElementChild?.innerHTML === "[+]"
			? li.ele.firstElementChild.children[1].firstElementChild
			: li.ele.querySelector(`.ui-list__btn-inline[title="Toggle Preview"]`);

		return {cbSel, btnShowHidePreview};
	}

	static absorbFnBindListeners (list, listItem) {
		listItem.ele.addEventListener("click", evt => ListUiUtil.handleSelectClick(list, listItem, evt));
	}

	static absorbFnBindListenersRadio (list, listItem) {
		listItem.ele.addEventListener("click", (evt) => ListUiUtil.handleSelectClickRadio(list, listItem, evt));
	}
}

export {UtilList2};
