using UnityEngine;

namespace Imperial.Butcher
{
    // A local exploration tutorial. It awards no persistent items, currency or XP.
    public sealed class ButcherTrailObjective : MonoBehaviour
    {
        public int Stage { get; private set; }
        public static readonly Vector3 Memorial = new Vector3(-6, 0, 3);
        public static readonly Vector3 Gateway = new Vector3(0, 0, 22);
        public static readonly Vector3 Campfire = new Vector3(5, 0, -3);

        public bool CanInteract => Stage < 3 && HorizontalDistance(Target) < 3.5f;
        Vector3 Target => Stage == 0 ? Memorial : Stage == 1 ? Gateway : Campfire;
        public Vector3 TargetPosition => Target;
        public float DistanceToTarget => HorizontalDistance(Target);
        public bool Complete => Stage >= 3;
        public string ObjectiveText => Stage == 0
            ? "A trail to remember\nFind the memorial beside the road and press E."
            : Stage == 1 ? "Scout the old gateway\nFollow the road to the arch and press E."
            : Stage == 2 ? "Return to camp\nMeet back at the firepit and press E."
            : "Trail explored\nYou can continue exploring. Your next adventure awaits.";

        void Update()
        {
            var menu = UnityEngine.Object.FindFirstObjectByType<ButcherCharacterMenu>();
            if (menu != null && menu.IsOpen) return;
            var world = UnityEngine.Object.FindFirstObjectByType<ButcherWorld>();
            if (world != null && world.MapOpen) return;
            var combat = UnityEngine.Object.FindFirstObjectByType<ButcherCombatController>();
            if (combat != null && combat.InTrial) return;
            if (Input.GetKeyDown(KeyCode.E)) Interact();
        }

        public bool Interact()
        {
            if (!CanInteract) return false;
            Stage++;
            return true;
        }

        float HorizontalDistance(Vector3 position)
        {
            var delta = transform.position - position;
            delta.y = 0;
            return delta.magnitude;
        }
    }
}
