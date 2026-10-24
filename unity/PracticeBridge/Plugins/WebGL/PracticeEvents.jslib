mergeInto(LibraryManager.library, {
 ImperialPracticeEvent: function(json) {
  window.dispatchEvent(new CustomEvent('imperial-unity-practice', {detail: JSON.parse(UTF8ToString(json))}));
 }
});
