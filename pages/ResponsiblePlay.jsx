import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import PracticePolicy from '@/components/casino/PracticePolicy';
import SelfExclusionControl from '@/components/casino/SelfExclusionControl';

export default function ResponsiblePlay() {
  return <PracticePolicy title="Responsible Play" icon={Heart}>
    <p>The tester-chip preview is for participants aged 21 or older. Fictional chips have no cash value, and the preview has no purchases or redemptions.</p>
    <section><h2>Keep practice enjoyable</h2><ul><li>Set a time limit and take regular breaks away from the screen.</li><li>Leave a table whenever you need to. A practice stack is never a reason to keep playing.</li><li>Keep gameplay balanced with sleep, work and other activities.</li><li>Use your own account and keep minors from accessing it.</li></ul></section>
    <section><h2>Ask for help</h2><p>If play becomes difficult to control or stops being enjoyable, stop playing and consider support from someone you trust or a qualified local support service. Use <Link to="/Support">support tickets</Link> for help with an account restriction.</p></section>
    <SelfExclusionControl />
  </PracticePolicy>;
}
