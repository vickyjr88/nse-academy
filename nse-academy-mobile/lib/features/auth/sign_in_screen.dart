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
  bool _busy = false;
  bool _hide = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).signIn(_email.text, _password.text);
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.statusCode == 401 ? 'That email and password do not match.' : e.message);
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
          Text('Sign in', style: AppText.h1(c.textPrimary)),
          const SizedBox(height: 8),
          Text('Use the same account as the NSE Academy website to unlock the courses on your plan.', style: AppText.body(c.textSecondary)),
          const SizedBox(height: 24),
          Form(
            key: _form,
            child: Column(children: [
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
                validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : null,
              ),
            ]),
          ),
          if (_error != null) ...[const SizedBox(height: 14), Text(_error!, style: AppText.bodySmall(c.loss), semanticsLabel: 'Error: $_error')],
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : const Text('Sign in')),
          const SizedBox(height: 16),
          Center(
            child: TextButton(
              onPressed: () => launchUrl(Uri.parse('${AppConfig.siteBase}/auth/register'), mode: LaunchMode.externalApplication),
              child: Text('New here? Create an account on the website', style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    );
  }
}
