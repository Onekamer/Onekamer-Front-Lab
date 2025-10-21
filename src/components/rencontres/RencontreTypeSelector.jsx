
    import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const RencontreTypeSelector = () => {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [initialSelected, setInitialSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTypes = useCallback(async () => {
    const { data, error } = await supabase.from('rencontres_types').select('id, nom').order('id');
    if (error) {
      console.error('Error fetching rencontre types:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les types de rencontre.', variant: 'destructive' });
      return;
    }
    setTypes(data);
  }, [toast]);

  const fetchUserSelection = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('rencontres_types_selection').select('type_id').eq('user_id', user.id);
    if (error) {
      console.error('Error fetching user selection:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger vos préférences.', variant: 'destructive' });
      return;
    }
    const selectedIds = data.map(item => item.type_id);
    setSelectedTypes(selectedIds);
    setInitialSelected(selectedIds);
  }, [user, toast]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTypes(), fetchUserSelection()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTypes, fetchUserSelection]);

  const handleToggleType = (typeId) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const handleSaveSelection = async () => {
    if (!user) return;
    setSaving(true);

    const typesToAdd = selectedTypes.filter(id => !initialSelected.includes(id));
    const typesToRemove = initialSelected.filter(id => !selectedTypes.includes(id));

    const operations = [];

    if (typesToRemove.length > 0) {
      operations.push(
        supabase.from('rencontres_types_selection').delete().eq('user_id', user.id).in('type_id', typesToRemove)
      );
    }

    if (typesToAdd.length > 0) {
      const recordsToInsert = typesToAdd.map(type_id => ({ user_id: user.id, type_id }));
      operations.push(
        supabase.from('rencontres_types_selection').insert(recordsToInsert)
      );
    }

    try {
      const results = await Promise.all(operations);
      const hasError = results.some(res => res.error);

      if (hasError) {
        throw new Error('Une erreur est survenue lors de la sauvegarde.');
      }

      toast({
        title: '✅ Préférences enregistrées',
        description: 'Vos types de rencontre ont été mis à jour.',
      });
      setInitialSelected(selectedTypes);
    } catch (error) {
      console.error('Error saving selection:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      // Revert state on error
      setSelectedTypes(initialSelected);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Types de rencontres souhaitées</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-6">
          {types.map(type => (
            <button
              key={type.id}
              onClick={() => handleToggleType(type.id)}
              className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
                selectedTypes.includes(type.id)
                  ? 'bg-gradient-to-r from-[#2BA84A] to-[#3ab55d] text-white border-transparent shadow-md'
                  : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {type.nom}
            </button>
          ))}
        </div>
        <Button onClick={handleSaveSelection} className="w-full bg-gradient-to-r from-[#2BA84A] to-[#F5C300] text-white font-bold" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer mes préférences
        </Button>
      </CardContent>
    </Card>
  );
};

export default RencontreTypeSelector;
  