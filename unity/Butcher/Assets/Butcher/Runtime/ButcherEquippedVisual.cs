using UnityEngine;
namespace Imperial.Butcher
{
    // Local presentation marker only. This object grants no inventory or bonuses.
    public sealed class ButcherEquippedVisual : MonoBehaviour
    {
        public string DefinitionId { get; private set; }
        public string Slot { get; private set; }
        public void Configure(string definitionId, string slot) { DefinitionId = definitionId; Slot = slot; }
    }
}
