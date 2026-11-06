using System;
using UnityEngine;

namespace Imperial.Butcher
{
    [CreateAssetMenu(menuName = "Butcher/Equipment Visual Catalog")]
    public sealed class ButcherEquipmentCatalog : ScriptableObject
    {
        [Serializable]
        public struct Entry
        {
            public string definitionId;
            public int definitionVersion;
            public string slot;
            public GameObject prefab;
            public HumanBodyBones bone;
            public Vector3 localPosition, localEuler;
        }
        [SerializeField] Entry[] entries;
        public bool TryResolve(string definitionId, int version, string slot, out Entry entry)
        {
            if (entries != null)
                foreach (var candidate in entries)
                    if (candidate.definitionId == definitionId && candidate.definitionVersion == version && candidate.slot == slot && candidate.prefab != null)
                    { entry = candidate; return true; }
            entry = default;
            return false;
        }
    }
}
