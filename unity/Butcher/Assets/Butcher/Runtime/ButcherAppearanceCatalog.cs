using System;
using UnityEngine;

namespace Imperial.Butcher
{
    [CreateAssetMenu(menuName = "Butcher/Appearance Catalog")]
    public sealed class ButcherAppearanceCatalog : ScriptableObject
    {
        [Serializable]
        public struct Entry
        {
            public string visualId;
            public GameObject prefab;
        }

        [SerializeField] Entry[] entries;

        // A saved character selects a known visual ID, never an arbitrary asset path.
        public GameObject Resolve(string visualId)
        {
            if (string.IsNullOrWhiteSpace(visualId) || entries == null) return null;
            foreach (var entry in entries)
                if (entry.visualId == visualId) return entry.prefab;
            return null;
        }
    }
}
