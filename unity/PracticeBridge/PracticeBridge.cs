using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;
// Attach to an object named PracticeBridge in the isolated practice scene.
// Visual subscribers must never calculate or settle wagers.
public sealed class PracticeBridge : MonoBehaviour {
 [Serializable] public class Outcome { public int version; public string mode; public string roundId; public string game; public int[] values; }
 [Serializable] public class OutcomeEvent : UnityEvent<string> {}
 public OutcomeEvent onPresentationRequested = new OutcomeEvent();
 readonly HashSet<string> seen = new HashSet<string>();
 public void PresentOutcome(string json) {
  Outcome o;
  try { o = JsonUtility.FromJson<Outcome>(json); } catch { return; }
  if (o == null || o.version != 1 || o.mode != "practice" || string.IsNullOrEmpty(o.roundId) || o.values == null) return;
  bool roulette = o.game == "roulette";
  if (!roulette && o.game != "craps") return;
  if (o.values.Length != (roulette ? 1 : 2)) return;
  foreach (int n in o.values) if (n < (roulette ? 0 : 1) || n > (roulette ? 36 : 6)) return;
  if (!seen.Add(o.roundId)) return;
  // Bounded replay cache for a presentation session.
  if (seen.Count > 256) { seen.Clear(); seen.Add(o.roundId); }
  onPresentationRequested.Invoke(json);
 }
}
