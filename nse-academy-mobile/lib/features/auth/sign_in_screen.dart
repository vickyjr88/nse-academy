import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';

/// Sign in with the NSE Academy website account. The plan on the account decides which course lessons unlock.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _referral = TextEditingController();
  bool _create = false;
  bool _busy = false;
  bool _hide = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _referral.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_create) {
        await ref.read(authProvider.notifier).register(name: _name.text, email: _email.text, password: _password.text, referralCode: _referral.text);
      } else {
        await ref.read(authProvider.notifier).signIn(_email.text, _password.text);
      }
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.statusCode == 401 ? 'That email and password do not match.' : (e.statusCode == 409 ? 'That email already has an account. Try signing in.' : e.message));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          Text(_create ? 'Create your free account' : 'Sign in', style: AppText.h1(c.textPrimary)),
          const SizedBox(height: 8),
          Text(_create ? 'Free to join. You get your investor profile, stock picks and the first chapters of every course.' : 'Use the same account as the NSE Academy website to unlock the courses and tools on your plan.', style: AppText.body(c.textSecondary)),
          const SizedBox(height: 24),
          Form(
            key: _form,
            child: Column(children: [
              if (_create) ...[
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
                ),
                const SizedBox(height: 14),
              ],
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                validator: (v) => (v == null || !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) ? 'Enter a valid email address' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _password,
                obscureText: _hide,
                autofillHints: const [AutofillHints.password],
                onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(labelText: 'Password', border: const OutlineInputBorder(), suffixIcon: IconButton(tooltip: _hide ? 'Show password' : 'Hide password', icon: Icon(_hide ? Icons.visibility_rounded : Icons.visibility_off_rounded), onPressed: () => setState(() => _hide = !_hide))),
                validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : (_create && v.length < 8 ? 'Use at least 8 characters' : null),
              ),
              if (_create) ...[
                const SizedBox(height: 14),
                TextFormField(controller: _referral, textCapitalization: TextCapitalization.none, decoration: const InputDecoration(labelText: 'Referral code (optional)', border: OutlineInputBorder())),
              ],
            ]),
          ),
          if (_error != null) ...[const SizedBox(height: 14), Text(_error!, style: AppText.bodySmall(c.loss), semanticsLabel: 'Error: $_error')],
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : Text(_create ? 'Create account' : 'Sign in')),
          if (_create) ...[
            const SizedBox(height: 10),
            Text.rich(TextSpan(style: AppText.caption(c.textSecondary), children: [
              const TextSpan(text: 'By creating an account you agree to our '),
              TextSpan(text: 'Terms of Service', style: TextStyle(color: c.primary, fontWeight: FontWeight.w600), recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('${AppConfig.siteBase}/terms'), mode: LaunchMode.externalApplication)),
              const TextSpan(text: ' and '),
              TextSpan(text: 'Privacy Policy', style: TextStyle(color: c.primary, fontWeight: FontWeight.w600), recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('${AppConfig.siteBase}/privacy'), mode: LaunchMode.externalApplication)),
              const TextSpan(text: '.'),
            ])),
          ],
          const SizedBox(height: 16),
          Center(
            child: TextButton(
              onPressed: () => setState(() {
                _create = !_create;
                _error = null;
              }),
              child: Text(_create ? 'Already have an account? Sign in' : 'New here? Create a free account', style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    );
  }
}
