using UnityEngine;

namespace Imperial.Butcher
{
    [RequireComponent(typeof(AudioSource))]
    public sealed class ButcherFootsteps : MonoBehaviour
    {
        CharacterController controller;
        AudioClip[] clips;
        AudioSource source;
        Vector3 previousPosition;
        float travelled;
        int lastClip = -1;
        public int StepsPlayed { get; private set; }

        public void Configure(CharacterController character, AudioClip[] sounds)
        {
            controller = character;
            clips = sounds;
            previousPosition = transform.position;
            source = GetComponent<AudioSource>();
            source.playOnAwake = false;
            source.spatialBlend = .65f;
            source.minDistance = 2;
            source.maxDistance = 14;
            source.volume = .24f;
        }

        void LateUpdate()
        {
            if (controller == null) return;
            Vector3 displacement = transform.position - previousPosition;
            previousPosition = transform.position;
            displacement.y = 0;
            // Teleports, standing still, and airborne movement never produce steps.
            if (!controller.isGrounded || displacement.magnitude > 2 || displacement.sqrMagnitude < .000001f)
            {
                travelled = 0;
                return;
            }
            travelled += displacement.magnitude;
            if (travelled < 1.6f || clips == null || clips.Length == 0) return;
            travelled %= 1.6f;
            int index = Random.Range(0, clips.Length);
            if (clips.Length > 1 && index == lastClip) index = (index + 1) % clips.Length;
            if (clips[index] == null) return;
            lastClip = index;
            source.pitch = Random.Range(.95f, 1.05f);
            source.PlayOneShot(clips[index]);
            StepsPlayed++;
        }
    }
}
